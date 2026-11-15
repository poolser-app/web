import assert from 'node:assert/strict';
import { chain, nftAbi, publicProvider } from '../src/contracts.ts';
import { loadPortfolio, loadV3 } from '../src/portfolio.ts';
import { Prices } from '../src/prices.ts';
import { call, Reader, Rpc, RpcError } from '../src/rpc.ts';
import type { Address } from 'viem';
import type { StorageLike } from '../src/types.ts';

async function main() {
  const endpoint = process.env.POOLSER_RPC_URL ?? publicProvider.url;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  const rpc = new Rpc(endpoint, controller.signal);
  const head = BigInt(await rpc.request<string>('eth_blockNumber'));
  const reader = new Reader(rpc, head);
  // Resolve an existing public sample from chain; never persist its address or portfolio capture.
  const wallet = process.env.POOLSER_LIVE_WALLET as Address | undefined ?? await reader.one<Address>(call(chain.v4, nftAbi, 'ownerOf', [4n]));
  const v3Wallet = await reader.one<Address>(call(chain.v4, nftAbi, 'ownerOf', [1n]));
  const v3Balance = await reader.one<bigint>(call(chain.v3, nftAbi, 'balanceOf', [v3Wallet]));
  const v3Positions = await loadV3(reader, v3Wallet, v3Balance, new Prices(controller.signal));
  assert.ok(v3Positions.length > 0, 'No funded v3 reference position was read');
  assert.ok(v3Positions.every(p => p.tick !== null && p.fees0 !== null), 'A v3 reference read failed');
  const entries = new Map<string, string>();
  const storage: StorageLike = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: key => { entries.delete(key); } };
  let lastProgress = 0;
  const result = await loadPortfolio({ endpoint, wallet, signal: controller.signal, storage, update: () => {}, progress: progress => {
    if (Date.now() - lastProgress > 15000) {
      console.log(progress.phase + (progress.scanned && progress.head ? ` · ${Number(progress.head - progress.scanned).toLocaleString('en-US')} blocks remaining` : ''));
      lastProgress = Date.now();
    }
  } });
  assert.ok(result.positions.some(p => p.version === 4), 'No funded v4 sample position was read');
  assert.ok(result.positions.every(p => p.tick !== null), 'A sample pool state was unavailable');
  assert.ok(result.positions.every(p => p.fees0 !== null && p.fees1 !== null), 'Some sample fee reads failed');
  assert.equal(result.complete, true, 'Sample discovery was incomplete');
  console.log(JSON.stringify({ status: 'passed', block: result.block, v3ReferencePositions: v3Positions.length, v4Positions: result.positions.filter(p => p.version === 4).length, complete: result.complete,
    positionsWithUSD: result.positions.filter(p => p.valueUSD !== null).length, priceWarnings: result.warnings.filter(w => /prices|price services/.test(w)).length }));
  process.removeListener('SIGINT', stop);
}

main().catch(error => { console.error(error instanceof RpcError ? error.message : 'Live validation did not pass. Check provider availability or use a suitable public sample wallet.'); process.exitCode = 1; });
