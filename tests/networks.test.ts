import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFunctionData, zeroAddress } from 'viem';
import { networkById, networks, networkOptions, supportedNetworks, supportsV3, supportsV4, readNetworks, saveNetworks, networkSelectionKey, validSelection, rpcEndpoint } from '../src/networks.ts';
import { loadNetworks, positionKey } from '../src/monitor.ts';
import { loadPortfolio, totals } from '../src/portfolio.ts';
import { Prices, priceAddress } from '../src/prices.ts';
import { Rpc, Reader, RequestBudget, delay } from '../src/rpc.ts';
import { discoverV4, readScan, scanKey } from '../src/discovery.ts';
import { tokenIconURL } from '../src/icons.ts';
import { abis, fixture, memoryStorage, wallet, usdc } from './fixtures.ts';
import type { Snapshot } from '../src/types.ts';

const signal = () => new AbortController().signal;
const options = () => ({ wallet, signal: signal(), storage: memoryStorage(), progress: () => {}, update: () => {}, creditsPerSecond: Infinity });
const endpoint = (id: number) => networkById(id).publicRPC!;
function matrixFetcher(fixtures: Map<number, ReturnType<typeof fixture>>): typeof fetch {
  return async (input, init) => {
    const network = networks.find(n => n.publicRPC === String(input));
    if (!network) return Response.json({ [usdc]: { usd: 1 } });
    return fixtures.get(network.id)!.fetcher(input, init);
  };
}

test('native capability matrix includes seven dual-version, six v3-only and three unsupported configurations', () => {
  assert.deepEqual(networks.filter(supportsV4).map(n => n.slug), ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'blast', 'unichain']);
  assert.deepEqual(supportedNetworks.filter(n => !supportsV4(n)).map(n => n.slug), ['avalanche', 'celo', 'zksync', 'bsc', 'megaeth', 'monad']);
  assert.deepEqual(networks.filter(n => !supportsV3(n) && !supportsV4(n)).map(n => n.slug), ['palm', 'linea', 'mantle']);
  assert.equal(networkById(324).multicall, '0xF9cda624FBC7e059355ce98a31693d299FACd963');
  assert.equal(networkById(130).v4Deployment, 0x680f5fn);
  assert.equal(networkById(8453).v3Deployment, 1371680);
  assert.equal(networkById(1).uniswapSlug, 'mainnet');
  assert.equal(networkById(56).uniswapSlug, 'bnb');
  for (const n of supportedNetworks) {
    assert.ok(n.publicRPC?.startsWith('https://'));
    assert.equal(rpcEndpoint(n, false, 'fictional-key'), `https://${n.infuraHost}.infura.io/v3/fictional-key`);
    assert.match(n.iconURL, /^https:\/\/coin-images.coingecko.com\//);
    assert.ok(tokenIconURL(n.id, usdc)?.includes(`/tokens/${n.id}/${usdc}`));
  }
});

test('network selection validates persistence, corruption, unsupported/duplicate/empty selections and storage failures', () => {
  const storage = memoryStorage();
  assert.deepEqual(readNetworks(storage).ids, [1]);
  assert.equal(saveNetworks(storage, [8453, 56]), null);
  assert.deepEqual(readNetworks(storage).ids, [8453, 56]);
  for (const ids of [[], [1, 1], [59144], ['1'], [999999]]) {
    assert.equal(validSelection(ids), false);
    storage.setItem(networkSelectionKey, JSON.stringify(ids));
    assert.ok(readNetworks(storage).warning);
    assert.throws(() => saveNetworks(storage, ids as number[]));
  }
  storage.setItem(networkSelectionKey, '{bad');
  assert.deepEqual(readNetworks(storage).ids, [1]);
  assert.ok(saveNetworks(null, [1])?.includes('only in this tab'));
});

test('all supported configurations load only their own deployed versions at a fixed chain block', async () => {
  for (const network of supportedNetworks) {
    const f = fixture({ chain: network });
    const result = await loadPortfolio({ ...options(), endpoint: endpoint(network.id), chain: network, fetcher: f.fetcher });
    assert.equal(result.complete, true, network.name);
    assert.deepEqual(result.positions.map(p => p.version), supportsV4(network) ? [3, 4] : [3]);
    assert.ok(result.positions.every(p => p.chainId === network.id));
    assert.equal(f.calls.some(c => c.method === 'eth_getLogs'), supportsV4(network));
    for (const c of f.calls.filter(c => c.method === 'eth_call')) {
      assert.equal(BigInt(c.params[1] as string), f.head);
      const tx = c.params[0] as { to: string; data: `0x${string}` };
      if (decodeFunctionData({ abi: abis, data: tx.data }).functionName === 'aggregate3') assert.equal(tx.to, network.multicall);
    }
  }
});

test('unsupported deployments and wrong-chain responses stop before any ownership, price or discovery reads', async () => {
  let requests = 0;
  await assert.rejects(loadPortfolio({ ...options(), endpoint: endpoint(1), chain: networkById(59144), fetcher: async () => { requests++; throw new Error(); } }), /No supported/);
  assert.equal(requests, 0);
  assert.throws(() => readScan(memoryStorage(), wallet, networkById(56)), /v4 is not supported/);
  const f = fixture();
  await assert.rejects(loadPortfolio({ ...options(), endpoint: endpoint(8453), chain: networkById(8453), fetcher: f.fetcher }), /wrong network.*Base/);
  assert.deepEqual(f.calls.map(c => c.method), ['eth_chainId']);
  await assert.rejects(loadNetworks({ ...options(), networkIds: [], publicRPC: true, key: '' }), /Select at least/);
});

test('parallel chains share serial credit pacing, including retries, and cancellation releases queued work', async () => {
  const budget = new RequestBudget(4000), starts: number[] = [];
  let attempts = 0, active = 0, peak = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    starts.push(Date.now()); peak = Math.max(peak, ++active);
    await delay(5); active--;
    const id = JSON.parse(String(init?.body)).id;
    return ++attempts === 1 ? new Response('', { status: 429 }) : Response.json({ jsonrpc: '2.0', id, result: '0x1' });
  };
  const a = new Rpc(endpoint(1), signal(), { budget, fetcher }), b = new Rpc(endpoint(8453), signal(), { budget, fetcher });
  await Promise.all([a.request('eth_chainId'), b.request('eth_blockNumber')]);
  assert.equal(peak, 1); assert.equal(attempts, 3);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 16, 'aggregate 80-credit spacing');
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(new Rpc(endpoint(56), cancelled.signal, { budget, fetcher }).request('eth_chainId'), { name: 'AbortError' });
  assert.equal(await b.request('eth_chainId'), '0x1');
});

test('discovery caches and cancellation/resume isolate wallets, chains, versions and identical NFT IDs', async () => {
  const storage = memoryStorage();
  for (const id of [1, 8453]) {
    const chain = networkById(id), controller = new AbortController(); let windows = 0;
    const f = fixture({ chain, head: chain.v4Deployment! + 60000n, logHook: () => { if (++windows === 2) { controller.abort(); throw controller.signal.reason; } } });
    await assert.rejects(discoverV4(new Reader(new Rpc(endpoint(id), controller.signal, { fetcher: f.fetcher, creditsPerSecond: Infinity }), f.head, chain), wallet, 1n, storage, () => {}), { name: 'AbortError' });
    assert.equal(BigInt(readScan(storage, wallet, chain).cache.nextBlock), chain.v4Deployment! + 20000n);
    const seen: bigint[] = [];
    const resumed = fixture({ chain, head: f.head, logHook: from => seen.push(from) });
    assert.equal((await discoverV4(new Reader(new Rpc(endpoint(id), signal(), { fetcher: resumed.fetcher, creditsPerSecond: Infinity }), f.head, chain), wallet, 1n, storage, () => {})).complete, true);
    assert.equal(seen[0], chain.v4Deployment! + 20000n - 24n);
  }
  assert.equal(storage.entries.size, 2);
  assert.equal(storage.getItem(scanKey(zeroAddress, networkById(1))), null);
  assert.equal(readScan(storage, zeroAddress, networkById(8453)).cache.candidates.length, 0);
  const keys = [positionKey(wallet, 1, 3, '1'), positionKey(wallet, 1, 4, '1'), positionKey(wallet, 8453, 3, '1'), positionKey(zeroAddress, 1, 3, '1')];
  assert.equal(new Set(keys).size, 4);
});

test('mixed failures preserve stale fixed-block snapshots while other chains advance, recover and exclude deselected/other-wallet data', async () => {
  const fixtures = new Map([1, 8453].map(id => [id, fixture({ chain: networkById(id) })]));
  const base = { ...options(), networkIds: [1, 8453], publicRPC: true, key: '', fetcher: matrixFetcher(fixtures) };
  const first = await loadNetworks(base);
  assert.equal(first.complete, true); assert.equal(first.positions.length, 4);
  const fail: typeof fetch = async (input, init) => String(input) === endpoint(1) ? Response.json({ error: { code: -32000, message: 'project key secret access denied' } }) : matrixFetcher(fixtures)(input, init);
  const nextFixture = fixture({ chain: networkById(8453), head: 30000000n });
  fixtures.set(8453, nextFixture);
  const updates: Snapshot[] = [];
  const next = await loadNetworks({ ...base, previous: first, fetcher: fail, update: s => updates.push(s) });
  assert.deepEqual(next.chains?.map(s => s.status), ['stale', 'ready']);
  assert.equal(next.chains![0].block, first.chains![0].block);
  assert.equal(next.chains![0].updatedAt, first.chains![0].updatedAt);
  assert.deepEqual(next.chains![0].positions, first.chains![0].positions);
  assert.equal(next.chains![1].block, '30000000');
  assert.equal(totals(next, 'valueUSD').partial, true);
  assert.ok(!JSON.stringify(next).includes('secret'));
  assert.ok(updates.some(s => s.chains?.[0].status === 'stale' && s.chains?.[1].status === 'loading'));
  const freshFailure = await loadNetworks({ ...base, previous: { ...first, wallet: zeroAddress }, fetcher: fail });
  assert.equal(freshFailure.chains![0].status, 'unavailable');
  assert.equal(freshFailure.chains![0].updatedAt, null);
  assert.equal(freshFailure.chains![0].positions.length, 0);
  const recovered = await loadNetworks({ ...base, previous: next });
  assert.equal(recovered.complete, true); assert.equal(recovered.chains![0].status, 'ready');
  const selected = await loadNetworks({ ...base, networkIds: [8453], previous: next });
  assert.ok(selected.positions.every(p => p.chainId === 8453));
});

test('partial ownership/position failures retain prior values and all-failed first loads stay unknown', async () => {
  const chain = networkById(1), f = fixture({ chain });
  const base = { ...options(), networkIds: [1], publicRPC: true, key: '', fetcher: f.fetcher };
  const first = await loadNetworks(base);
  const partial = await loadNetworks({ ...base, previous: first, fetcher: fixture({ collectFails: true }).fetcher });
  assert.equal(partial.chains![0].status, 'stale');
  assert.deepEqual(partial.positions, first.positions);
  assert.ok(partial.warnings.some(w => w.includes('previous snapshot')));
  const failed = await loadNetworks({ ...base, fetcher: async () => Response.json({ error: { code: 1, message: 'access denied' } }) });
  assert.equal(totals(failed, 'valueUSD').value, null);
  assert.equal(failed.complete, false);
  const empty = await loadNetworks({ ...base, fetcher: fixture({ empty: true }).fetcher });
  assert.equal(totals(empty, 'valueUSD').value, 0);
  assert.equal(empty.complete, true);
});

test('native prices, currency symbols, wrappers and price caches remain scoped to chain even with identical token addresses', async () => {
  for (const [id, symbol, platform, llama] of [[137, 'POL', 'polygon-pos', 'polygon'], [56, 'BNB', 'binance-smart-chain', 'bsc'], [43114, 'AVAX', 'avalanche', 'avax'], [42220, 'CELO', 'celo', 'celo'], [324, 'ETH', 'zksync', 'era']] as const) {
    const chain = networkById(id), urls: string[] = [];
    const prices = new Prices(signal(), async input => {
      urls.push(String(input));
      if (String(input).includes('coingecko')) throw new Error('unavailable');
      return Response.json({ coins: { [`${llama}:${priceAddress(zeroAddress, chain)}`]: { price: id }, [`${llama}:${usdc}`]: { price: 1 } } });
    }, chain);
    assert.equal((await prices.get([zeroAddress, usdc])).get(priceAddress(zeroAddress, chain)), id);
    assert.ok(urls[0].includes(`token_price/${platform}?`));
    assert.ok(urls[1].includes(`${llama}:${chain.wrappedNative.toLowerCase()}`));
    assert.equal((await prices.get([zeroAddress])).get(priceAddress(zeroAddress, chain)), id);
    assert.equal(urls.length, 2);
    const f = fixture({ chain, nativeV3: true });
    const loaded = await loadPortfolio({ ...options(), chain, endpoint: endpoint(id), fetcher: f.fetcher });
    assert.equal(loaded.positions[0].token0.symbol, symbol);
    assert.equal(loaded.positions[0].token0.decimals, 18);
  }
});

test('pausing an aggregate read retains chain snapshots and never advances another chain cursor', async () => {
  const controller = new AbortController(), storage = memoryStorage();
  const chain = networkById(8453);
  let queries = 0;
  const f = fixture({ chain, head: chain.v4Deployment! + 60000n, logHook: () => { if (++queries === 2) { controller.abort(); throw controller.signal.reason; } } });
  const result = await loadNetworks({ ...options(), signal: controller.signal, storage, networkIds: [8453], publicRPC: true, key: '', fetcher: f.fetcher });
  assert.equal(result.complete, false); assert.equal(result.chains![0].status, 'stale');
  assert.ok(result.positions.some(p => p.version === 3));
  assert.equal(BigInt(readScan(storage, wallet, chain).cache.nextBlock), chain.v4Deployment! + 20000n);
  assert.equal(storage.getItem(scanKey(wallet, networkById(1))), null);
});

test('ownership failure is partial without a baseline and retains the whole last snapshot with a baseline', async () => {
  const base = { ...options(), networkIds: [1], publicRPC: true, key: '' };
  const first = await loadNetworks({ ...base, fetcher: fixture().fetcher });
  const failed = fixture({ balanceFailsFor: 3 });
  const partial = await loadNetworks({ ...base, fetcher: failed.fetcher });
  assert.equal(partial.chains![0].status, 'partial');
  assert.deepEqual(partial.positions.map(p => p.version), [4]);
  assert.equal(totals(partial, 'valueUSD').partial, true);
  const stale = await loadNetworks({ ...base, previous: first, fetcher: failed.fetcher });
  assert.deepEqual(stale.positions, first.positions);
  assert.equal(stale.chains![0].updatedAt, first.chains![0].updatedAt);
  assert.equal(stale.chains![0].status, 'stale');
});

test('chain-specific multicall splits provider-size failures and falls back to single reads without changing blocks', async () => {
  const chain = networkById(324);
  for (const multicall of [chain.multicall, null]) {
    const f = fixture({ chain, maximumBatch: 1 });
    const result = await loadPortfolio({ ...options(), chain: { ...chain, multicall }, endpoint: endpoint(324), fetcher: f.fetcher });
    assert.equal(result.complete, true);
    assert.equal(result.positions.length, 1);
    assert.ok(f.calls.filter(c => c.method === 'eth_call').every(c => BigInt(c.params[1] as string) === f.head));
  }
});


test('Blast is excluded from monitoring and saved selections retain other networks without issuing requests', async () => {
  assert.ok(networks.some(n => n.id === 81457 && supportsV3(n) && supportsV4(n)));
  assert.equal(supportedNetworks.length, 12);
  assert.ok(!networkOptions.some(n => n.id === 81457));
  const storage = memoryStorage();
  storage.setItem(networkSelectionKey, JSON.stringify([8453, 81457, 56]));
  assert.deepEqual(readNetworks(storage).ids, [8453, 56]);
  assert.match(readNetworks(storage).warning!, /Blast is no longer monitored/);
  storage.setItem(networkSelectionKey, JSON.stringify([81457]));
  assert.deepEqual(readNetworks(storage).ids, [1]);
  assert.ok(readNetworks(storage).warning);
  storage.setItem(networkSelectionKey, JSON.stringify([81457, 81457, 8453]));
  assert.deepEqual(readNetworks(storage).ids, [1]);
  assert.throws(() => saveNetworks(storage, [81457]), /Select at least/);
  let requests = 0;
  await assert.rejects(loadNetworks({ ...options(), networkIds: [1, 81457], publicRPC: true, key: '', fetcher: async () => { requests++; throw new Error(); } }), /Select at least/);
  assert.equal(requests, 0);
});
