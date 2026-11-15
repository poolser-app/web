import { zeroAddress, toHex } from 'viem';
import type { Address, Hex } from 'viem';
import { chain, nftAbi, v3Abi, factoryAbi, poolAbi, tokenAbi, v4Abi, stateAbi } from './contracts.ts';
import { amounts, decodeTicks, poolId, priced, unclaimedFee } from './math.ts';
import { aborted, call, Reader, Rpc, RpcError, value } from './rpc.ts';
import { discoverV4 } from './discovery.ts';
import { Prices, priceAddress } from './prices.ts';
import type { Position, Progress, Snapshot, StorageLike, Token } from './types.ts';

type Fields = { id: string; version: 3 | 4; token0: Address; token1: Address; fee: number; lower: number; upper: number; liquidity: bigint; pool: Address | Hex | null; fees?: [bigint, bigint] };
type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
type V3Fields = readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];

function failedPosition(id: string, version: 3 | 4): Position {
  const token: Token = { address: zeroAddress, symbol: 'Unknown', decimals: null, price: null };
  return { id, version, token0: token, token1: token, fee: 0, lower: 0, upper: 0, tick: null, liquidity: '0', amount0: null, amount1: null, fees0: null, fees1: null, valueUSD: null, feesUSD: null, errors: ['Position data could not be read. Refresh to retry.'] };
}

async function metadata(reader: Reader, fields: Fields[], prices: Prices): Promise<Map<string, Token>> {
  const addresses = [...new Set(fields.flatMap(f => [f.token0, f.token1]).map(a => a.toLowerCase() as Address))];
  const contracts = addresses.filter(a => a !== zeroAddress);
  const result = await reader.batch(contracts.flatMap(a => [call(a, tokenAbi, 'symbol'), call(a, tokenAbi, 'decimals')]));
  const usd = await prices.get(addresses);
  const tokens = new Map<string, Token>();
  tokens.set(zeroAddress, { address: zeroAddress, symbol: 'ETH', decimals: 18, price: usd.get(priceAddress(zeroAddress)) ?? null });
  contracts.forEach((address, i) => {
    const symbol = value<string>(result[2 * i]);
    const decimals = value<number>(result[2 * i + 1]);
    tokens.set(address, { address, symbol: typeof symbol === 'string' && symbol.length ? symbol.slice(0, 40) : `${address.slice(0, 6)}…${address.slice(-4)}`,
      decimals: typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255 ? decimals : null,
      price: usd.get(priceAddress(address)) ?? null });
  });
  return tokens;
}

async function finish(reader: Reader, fields: Fields[], prices: Prices): Promise<Position[]> {
  const tokens = await metadata(reader, fields, prices);
  const stateCalls = fields.flatMap(f => f.pool === null ? [] : f.version === 3
    ? [call(f.pool as Address, poolAbi, 'slot0')]
    : [call(chain.stateView, stateAbi, 'getSlot0', [f.pool]),
      call(chain.stateView, stateAbi, 'getPositionInfo', [f.pool, chain.v4, f.lower, f.upper, toHex(BigInt(f.id), { size: 32 })]),
      call(chain.stateView, stateAbi, 'getTickInfo', [f.pool, f.lower]),
      call(chain.stateView, stateAbi, 'getTickInfo', [f.pool, f.upper]),
      call(chain.stateView, stateAbi, 'getFeeGrowthGlobals', [f.pool])]);
  const results = await reader.batch(stateCalls);
  let index = 0;
  return fields.map(f => {
    const count = f.pool === null ? 0 : f.version === 3 ? 1 : 5;
    const reads = results.slice(index, index + count); index += count;
    const token0 = tokens.get(f.token0.toLowerCase())!, token1 = tokens.get(f.token1.toLowerCase())!;
    const state = value<readonly [bigint, number]>(reads[0]);
    const errors: string[] = [];
    let rawFees = f.fees;
    if (f.version === 4 && state) {
      const position = value<readonly [bigint, bigint, bigint]>(reads[1]);
      const lo = value<readonly [bigint, bigint, bigint, bigint]>(reads[2]);
      const hi = value<readonly [bigint, bigint, bigint, bigint]>(reads[3]);
      const global = value<readonly [bigint, bigint]>(reads[4]);
      if (position && lo && hi && global && position[0] === f.liquidity) {
        rawFees = [0, 1].map(i => unclaimedFee(global[i], lo[i + 2], hi[i + 2], position[i + 1], f.liquidity, state[1], f.lower, f.upper)) as [bigint, bigint];
      }
    }
    if (!state || state[0] <= 0n) errors.push('Pool state is unavailable. Holdings and range status will retry on refresh.');
    if (!rawFees) errors.push('Unclaimed fees could not be read. This is not a zero balance.');
    if (token0.decimals === null || token1.decimals === null) errors.push('Token decimals are unavailable. Amounts will not be guessed.');
    const pairAmounts = state && state[0] > 0n && token0.decimals !== null && token1.decimals !== null
      ? amounts(f.liquidity, state[0], f.lower, f.upper, token0.decimals, token1.decimals) : [null, null];
    const fees0 = rawFees && token0.decimals !== null ? Number(rawFees[0]) / 10 ** token0.decimals : null;
    const fees1 = rawFees && token1.decimals !== null ? Number(rawFees[1]) / 10 ** token1.decimals : null;
    return { id: f.id, version: f.version, token0, token1, fee: f.fee, lower: f.lower, upper: f.upper,
      tick: state && state[0] > 0n ? state[1] : null, liquidity: f.liquidity.toString(), amount0: pairAmounts[0], amount1: pairAmounts[1], fees0, fees1,
      valueUSD: priced(pairAmounts[0], token0.price, pairAmounts[1], token1.price), feesUSD: priced(fees0, token0.price, fees1, token1.price), errors };
  });
}

export async function loadV3(reader: Reader, wallet: Address, balance: bigint, prices: Prices): Promise<Position[]> {
  if (balance > BigInt(Number.MAX_SAFE_INTEGER)) throw new RpcError('The position count exceeds this browser’s safe enumeration range.', 'invalid');
  const positions: Position[] = [];
  for (let start = 0n; start < balance; start += 80n) {
    const count = Number(balance - start > 80n ? 80n : balance - start);
    const ids = await reader.batch(Array.from({ length: count }, (_, i) => call(chain.v3, nftAbi, 'tokenOfOwnerByIndex', [wallet, start + BigInt(i)])));
    const known = ids.map((result, i) => ({ id: value<bigint>(result), index: start + BigInt(i) }));
    const loaded = await reader.batch(known.filter(i => i.id !== null).map(i => call(chain.v3, v3Abi, 'positions', [i.id])));
    const fields: Fields[] = [];
    let index = 0;
    for (const item of known) {
      if (item.id === null) { positions.push(failedPosition(`unread-${item.index}`, 3)); continue; }
      const data = value<V3Fields>(loaded[index++]);
      if (!data) { positions.push(failedPosition(item.id.toString(), 3)); continue; }
      const f: Fields = { id: item.id.toString(), version: 3, token0: data[2], token1: data[3], fee: data[4], lower: data[5], upper: data[6], liquidity: data[7], pool: null };
      try {
        f.fees = await reader.one<readonly [bigint, bigint]>(call(chain.v3, v3Abi, 'collect', [{ tokenId: item.id, recipient: wallet, amount0Max: (1n << 128n) - 1n, amount1Max: (1n << 128n) - 1n }]), wallet) as [bigint, bigint];
      } catch { aborted(reader.rpc.signal); }
      if (f.liquidity === 0n && f.fees?.every(n => n === 0n)) continue;
      fields.push(f);
    }
    const pools = await reader.batch(fields.map(f => call(chain.factory, factoryAbi, 'getPool', [f.token0, f.token1, f.fee])));
    fields.forEach((f, i) => { const pool = value<Address>(pools[i]); f.pool = pool && pool !== zeroAddress ? pool : null; });
    positions.push(...await finish(reader, fields, prices));
  }
  return positions;
}

async function loadV4(reader: Reader, ids: string[], prices: Prices): Promise<Position[]> {
  const results = await reader.batch(ids.flatMap(id => [call(chain.v4, v4Abi, 'getPoolAndPositionInfo', [BigInt(id)]), call(chain.v4, v4Abi, 'getPositionLiquidity', [BigInt(id)])]));
  const fields: Fields[] = [], failed: Position[] = [];
  ids.forEach((id, i) => {
    const data = value<readonly [PoolKey, bigint]>(results[2 * i]);
    const liquidity = value<bigint>(results[2 * i + 1]);
    if (!data || liquidity === null) { failed.push(failedPosition(id, 4)); return; }
    if (liquidity === 0n) return;
    const ticks = decodeTicks(data[1]);
    fields.push({ id, version: 4, token0: data[0].currency0, token1: data[0].currency1, fee: data[0].fee, ...ticks, liquidity, pool: poolId(data[0]) });
  });
  return [...await finish(reader, fields, prices), ...failed];
}

export async function loadPortfolio(options: { endpoint: string; wallet: Address; signal: AbortSignal; storage: StorageLike | null; progress: (p: Progress) => void; update: (s: Snapshot) => void; fetcher?: typeof fetch; creditsPerSecond?: number }): Promise<Snapshot> {
  const rpc = new Rpc(options.endpoint, options.signal, { fetcher: options.fetcher, creditsPerSecond: options.creditsPerSecond });
  const prices = new Prices(options.signal, options.fetcher);
  options.progress({ phase: 'Checking Ethereum connection' });
  if (BigInt(await rpc.request<string>('eth_chainId')) !== 1n) throw new RpcError('This prototype requires Ethereum mainnet (chain 1).', 'invalid');
  const block = BigInt(await rpc.request<string>('eth_blockNumber'));
  const reader = new Reader(rpc, block);
  const balances = await reader.batch([call(chain.v3, nftAbi, 'balanceOf', [options.wallet]), call(chain.v4, nftAbi, 'balanceOf', [options.wallet])]);
  const warnings: string[] = [];
  let positions: Position[] = [], complete = true;
  const snapshot = (): Snapshot => ({ wallet: options.wallet, block: block.toString(), updatedAt: Date.now(), positions: [...positions], complete, warnings: [...new Set([...warnings, ...prices.warnings])] });
  options.progress({ phase: 'Reading v3 positions' });
  const v3Balance = value<bigint>(balances[0]), v4Balance = value<bigint>(balances[1]);
  if (v3Balance === null) { warnings.push('v3 ownership could not be read. Portfolio totals are incomplete.'); complete = false; }
  else positions = await loadV3(reader, options.wallet, v3Balance, prices);
  if (v4Balance === null) { warnings.push('v4 ownership could not be read. Portfolio totals are incomplete.'); complete = false; }
  const discoveryPending = v4Balance !== null && v4Balance > 0n;
  options.update({ ...snapshot(), complete: complete && !discoveryPending });
  if (v4Balance !== null) {
    try {
      const discovery = await discoverV4(reader, options.wallet, v4Balance, options.storage, options.progress);
      warnings.push(...discovery.warnings); complete &&= discovery.complete;
      options.progress({ phase: 'Reading v4 positions and unclaimed fees' });
      positions.push(...await loadV4(reader, discovery.ids, prices));
    } catch (error) {
      aborted(options.signal);
      complete = false;
      warnings.push(error instanceof RpcError ? `v4 discovery paused: ${error.message}` : 'v4 discovery could not finish. Refresh to resume from the last saved block.');
    }
  }
  const result = snapshot();
  options.update(result);
  return result;
}

export function totals(snapshot: Snapshot, metric: 'valueUSD' | 'feesUSD') {
  const known = snapshot.positions.filter(p => p[metric] !== null);
  const partial = !snapshot.complete || known.length !== snapshot.positions.length;
  return { value: known.length || (!partial && !snapshot.positions.length) ? known.reduce((sum, p) => sum + p[metric]!, 0) : null, partial, unknown: snapshot.positions.length - known.length };
}
