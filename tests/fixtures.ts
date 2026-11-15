import { decodeFunctionData, encodeFunctionResult, pad, toHex, zeroAddress } from 'viem';
import type { Abi, Address, Hex } from 'viem';
import { chain, nftAbi, v3Abi, factoryAbi, poolAbi, tokenAbi, v4Abi, stateAbi, multicallAbi, transferTopic } from '../src/contracts.ts';
import { Q128 } from '../src/math.ts';
import type { StorageLike } from '../src/types.ts';

export const wallet: Address = '0x0000000000000000000000000000000000001234';
export const usdc: Address = '0x0000000000000000000000000000000000000011';
export const weth: Address = '0x0000000000000000000000000000000000000022';
const pool: Address = '0x0000000000000000000000000000000000000033';
export const abis: Abi = [...nftAbi, ...v3Abi, ...factoryAbi, ...poolAbi, ...tokenAbi, ...v4Abi, ...stateAbi, ...multicallAbi];
export const sqrtAt = (tick: number) => BigInt(Math.floor(Math.exp(tick * Math.log(1.0001) / 2) * 2 ** 96));
export const packed = (lower: number, upper: number) => (BigInt.asUintN(24, BigInt(upper)) << 32n) | (BigInt.asUintN(24, BigInt(lower)) << 8n);

export function memoryStorage(): StorageLike & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: key => { entries.delete(key); } };
}

export function fixture(options: { collectFails?: boolean; decimalsFail?: boolean; ownerFails?: boolean; maximumLogRange?: bigint; head?: bigint; logHook?: (from: bigint, to: bigint) => void } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const head = options.head ?? chain.v4Deployment + 100n;
  const dispatch = (to: Address, data: Hex, from?: Address): Hex => {
    const decoded = decodeFunctionData({ abi: abis, data });
    const args = (decoded.args ?? []) as readonly unknown[];
    const name = decoded.functionName;
    let result: unknown;
    switch (name) {
      case 'aggregate3': result = (args[0] as { target: Address; callData: Hex }[]).map(item => {
        try { return { success: true, returnData: dispatch(item.target, item.callData) }; }
        catch { return { success: false, returnData: '0x' }; }
      }); break;
      case 'balanceOf': result = 1n; break;
      case 'ownerOf': if (options.ownerFails) return '0x'; result = wallet; break;
      case 'tokenOfOwnerByIndex': result = 1n; break;
      case 'positions': result = [0n, zeroAddress, usdc, weth, 500, 190000, 210000, 10n ** 16n, 0n, 0n, 0n, 0n]; break;
      case 'collect': if (options.collectFails || from !== wallet) throw new Error('revert'); result = [0n, 0n]; break;
      case 'getPool': result = pool; break;
      case 'slot0': result = [sqrtAt(200000), 200000, 0, 0, 0, 0, true]; break;
      case 'symbol': result = to.toLowerCase() === usdc ? 'USDC' : 'WETH'; break;
      case 'decimals': if (options.decimalsFail) return '0x'; result = to.toLowerCase() === usdc ? 6 : 18; break;
      case 'getPoolAndPositionInfo': result = [{ currency0: zeroAddress, currency1: usdc, fee: 500, tickSpacing: 10, hooks: zeroAddress }, packed(-210000, -190000)]; break;
      case 'getPositionLiquidity': result = 10n ** 12n; break;
      case 'getSlot0': result = [sqrtAt(-200000), -200000, 0, 500]; break;
      case 'getPositionInfo': result = [10n ** 12n, 1n << 200n, 1n << 200n]; break;
      case 'getTickInfo': result = [10n ** 12n, 0n, 0n, 0n]; break;
      case 'getFeeGrowthGlobals': result = [(1n << 200n) + Q128 / 10n ** 10n, (1n << 200n) + Q128 / 10n ** 8n]; break;
      default: throw new Error(`Unhandled fixture call: ${name}`);
    }
    return encodeFunctionResult({ abi: abis, functionName: name, result });
  };
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).startsWith('https://api.coingecko.com')) return Response.json({ [usdc]: { usd: 1 }, [weth]: { usd: 3200 }, [chain.wrappedNative.toLowerCase()]: { usd: 3200 } });
    if (String(input).startsWith('https://coins.llama.fi')) return Response.json({ coins: {} });
    const { id, method, params } = JSON.parse(String(init?.body));
    calls.push({ method, params });
    let result: unknown;
    if (method === 'eth_chainId') result = '0x1';
    else if (method === 'eth_blockNumber') result = toHex(head);
    else if (method === 'eth_getLogs') {
      const [filter] = params;
      const from = BigInt(filter.fromBlock), to = BigInt(filter.toBlock);
      options.logHook?.(from, to);
      if (options.maximumLogRange && to - from + 1n > options.maximumLogRange) return Response.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'block range exceeds limit' } }, { status: 400 });
      result = [{ address: chain.v4, topics: [transferTopic, pad(zeroAddress), pad(wallet), toHex(1n, { size: 32 })] }];
    } else if (method === 'eth_call') {
      try { result = dispatch(params[0].to, params[0].data, params[0].from); }
      catch { return Response.json({ jsonrpc: '2.0', id, error: { code: 3, message: 'execution reverted' } }); }
    } else throw new Error(`Unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: '2.0', id, result });
  };
  return { fetcher, calls, head };
}
