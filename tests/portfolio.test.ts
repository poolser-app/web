import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chain } from '../src/contracts.ts';
import { loadPortfolio, totals } from '../src/portfolio.ts';
import { Rpc, Reader } from '../src/rpc.ts';
import { checkOwners, discoverV4, readScan, scanStart } from '../src/discovery.ts';
import { Prices } from '../src/prices.ts';
import { fixture, memoryStorage, wallet, usdc } from './fixtures.ts';
import type { Snapshot } from '../src/types.ts';

test('complete encoded RPC fixture loads v3 and v4 at one block with known-zero v3 fees', async () => {
  const f = fixture(), storage = memoryStorage(), updates: Snapshot[] = [];
  const result = await loadPortfolio({ endpoint: 'https://rpc.invalid', wallet, signal: new AbortController().signal, storage, progress: () => {}, update: next => updates.push(next), fetcher: f.fetcher, creditsPerSecond: Infinity });
  assert.equal(result.complete, true);
  assert.deepEqual(result.positions.map(p => p.version), [3, 4]);
  assert.equal(result.positions[0].feesUSD, 0);
  assert.ok(result.positions[0].valueUSD! > 0);
  assert.ok(result.positions[1].feesUSD! > 0);
  assert.equal(result.positions[1].errors.length, 0);
  assert.equal(updates[0].complete, false);
  assert.equal(updates[0].positions.length, 1);
  assert.equal(totals(result, 'valueUSD').partial, false);
  for (const c of f.calls.filter(c => c.method === 'eth_call')) assert.equal(BigInt(c.params[1] as string), f.head);
  assert.ok(f.calls.every(c => ['eth_call', 'eth_chainId', 'eth_blockNumber', 'eth_getLogs'].includes(c.method)));
  assert.ok([...storage.entries.values()].every(data => !data.includes('rpc.invalid')));
});

test('a failed collect simulation is unavailable, never a known-zero fee', async () => {
  const f = fixture({ collectFails: true });
  const result = await loadPortfolio({ endpoint: 'https://rpc.invalid', wallet, signal: new AbortController().signal, storage: memoryStorage(), progress: () => {}, update: () => {}, fetcher: f.fetcher, creditsPerSecond: Infinity });
  const p = result.positions.find(p => p.version === 3)!;
  assert.equal(p.feesUSD, null); assert.equal(p.fees0, null);
  assert.ok(p.errors.some(s => s.includes('not a zero')));
  assert.equal(totals(result, 'feesUSD').unknown, 1);
});

test('unreadable token decimals are not silently replaced with 18', async () => {
  const f = fixture({ decimalsFail: true });
  const result = await loadPortfolio({ endpoint: 'https://rpc.invalid', wallet, signal: new AbortController().signal, storage: memoryStorage(), progress: () => {}, update: () => {}, fetcher: f.fetcher, creditsPerSecond: Infinity });
  assert.ok(result.positions.every(p => p.valueUSD === null && p.feesUSD === null));
  assert.ok(result.positions.every(p => p.errors.some(error => error.includes('decimals'))));
});

test('cancelled discovery retains completed windows and resumes with reorg overlap', async () => {
  const storage = memoryStorage(), controller = new AbortController();
  let queries = 0;
  const f = fixture({ head: chain.v4Deployment + 60000n, logHook: () => { if (++queries === 2) { controller.abort(); throw controller.signal.reason; } } });
  const reader = new Reader(new Rpc('https://rpc.invalid', controller.signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head);
  await assert.rejects(discoverV4(reader, wallet, 1n, storage, () => {}), { name: 'AbortError' });
  const checkpoint = readScan(storage, wallet).cache;
  assert.equal(BigInt(checkpoint.nextBlock), chain.v4Deployment + 20000n);
  assert.deepEqual(checkpoint.candidates, ['1']);
  const seen: bigint[] = [];
  const next = fixture({ head: f.head, logHook: from => seen.push(from) });
  const resumed = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: next.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 1n, storage, () => {});
  assert.equal(seen[0], chain.v4Deployment + 20000n - 24n);
  assert.deepEqual(resumed.ids, ['1']); assert.equal(resumed.complete, true);
  assert.equal(readScan(storage, wallet).cache.nextBlock, (f.head + 1n).toString());
});

test('restricted providers shrink log windows without skipping blocks', async () => {
  const ranges: [bigint, bigint][] = [];
  const f = fixture({ head: chain.v4Deployment + 250n, maximumLogRange: 50n, logHook: (from, to) => { if (to - from + 1n <= 50n) ranges.push([from, to]); } });
  const storage = memoryStorage();
  const result = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 1n, storage, () => {});
  assert.equal(result.complete, true);
  assert.equal(ranges[0][0], chain.v4Deployment);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i][0], ranges[i - 1][1] + 1n);
  assert.equal(ranges.at(-1)![1], f.head);
  assert.ok(readScan(storage, wallet).cache.chunkSize <= 50);
});

test('transient owner read errors retain candidates and remain incomplete until retried', async () => {
  const storage = memoryStorage();
  const f = fixture({ ownerFails: true });
  const reader = new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head);
  const ownership = await checkOwners(reader, ['1'], wallet);
  assert.equal(ownership.failed, 1);
  const first = await discoverV4(reader, wallet, 1n, storage, () => {});
  assert.equal(first.complete, false);
  assert.deepEqual(readScan(storage, wallet).cache.candidates, ['1']);
  const next = fixture();
  const recovered = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: next.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 1n, storage, () => {});
  assert.equal(recovered.complete, true); assert.deepEqual(recovered.ids, ['1']);
});

test('a lagging RPC head never rewinds persisted discovery', async () => {
  const storage = memoryStorage();
  const f = fixture();
  storage.setItem(`poolser:v1:1:v4:${wallet}`, JSON.stringify({ schema: 1, nextBlock: (f.head + 100n).toString(), candidates: ['1'], chunkSize: 20000 }));
  const before = storage.getItem(`poolser:v1:1:v4:${wallet}`);
  const result = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 1n, storage, () => {});
  assert.equal(result.complete, false); assert.ok(result.warnings[0].includes('behind'));
  assert.equal(storage.getItem(`poolser:v1:1:v4:${wallet}`), before);
  assert.equal(scanStart(f.head + 100n, f.head), null);
});

test('a refresh bounds log work and returns known owned IDs without presenting a complete portfolio', async () => {
  const storage = memoryStorage();
  const f = fixture({ head: chain.v4Deployment + 5000000n });
  const result = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 2n, storage, () => {});
  assert.equal(f.calls.filter(c => c.method === 'eth_getLogs').length, 120);
  assert.equal(result.complete, false); assert.deepEqual(result.ids, ['1']);
  assert.equal(readScan(storage, wallet).cache.nextBlock, (chain.v4Deployment + 2400000n).toString());
  assert.ok(result.warnings.some(w => w.includes('120 log windows')));
});

test('corrupt local data resets explicitly and unavailable storage does not break monitoring', async () => {
  const storage = memoryStorage(); storage.setItem(`poolser:v1:1:v4:${wallet}`, '{bad JSON');
  assert.ok(readScan(storage, wallet).warning);
  assert.equal(readScan(storage, wallet).cache.nextBlock, chain.v4Deployment.toString());
  const f = fixture();
  const result = await discoverV4(new Reader(new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head), wallet, 1n, null, () => {});
  assert.equal(result.complete, true);
  assert.ok(result.warnings.some(w => w.includes('storage')));
});

test('price fallback handles browser-like failures and caches a successful result', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async input => {
    requests++;
    if (String(input).includes('coingecko')) throw new TypeError('Failed to fetch');
    return Response.json({ coins: { [`ethereum:${usdc}`]: { price: 1 } } });
  };
  const prices = new Prices(new AbortController().signal, fetcher);
  assert.equal((await prices.get([usdc])).get(usdc), 1);
  assert.equal((await prices.get([usdc])).get(usdc), 1);
  assert.equal(requests, 2);
  assert.equal(prices.warnings.size, 1);
});
