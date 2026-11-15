import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rpc, RpcError, delay } from '../src/rpc.ts';
import { Prices } from '../src/prices.ts';

test('default RPC and price fetch retain the browser global receiver', async () => {
  const original = globalThis.fetch;
  const token = '0x0000000000000000000000000000000000000011';
  let requests = 0;
  globalThis.fetch = async function (this: unknown, _input, init) {
    assert.equal(this, globalThis);
    requests++;
    return init?.method === 'POST'
      ? Response.json({ jsonrpc: '2.0', id: JSON.parse(String(init.body)).id, result: '0x1' })
      : Response.json({ [token]: { usd: 1 } });
  };
  try {
    const signal = new AbortController().signal;
    assert.equal(await new Rpc('https://rpc.invalid', signal).request('eth_chainId'), '0x1');
    assert.equal((await new Prices(signal).get([token])).get(token), 1);
    assert.equal(requests, 2);
  } finally { globalThis.fetch = original; }
});

test('RPC errors redact provider messages and credential-bearing URLs', async () => {
  const secret = 'not-a-real-key-for-the-test';
  const rpc = new Rpc(`https://rpc.invalid/${secret}`, new AbortController().signal, { fetcher: async (_input, init) => Response.json({ id: JSON.parse(String(init?.body)).id, error: { code: -32000, message: `project access denied at https://rpc.invalid/${secret}` } }) });
  await assert.rejects(rpc.request('eth_blockNumber'), error => error instanceof RpcError && error.kind === 'access' && !String(error).includes(secret));
});

test('429 responses retry and RPC requests share one serial pacing queue', async () => {
  let attempts = 0, inFlight = 0, peak = 0;
  const rpc = new Rpc('https://rpc.invalid', new AbortController().signal, { creditsPerSecond: Infinity, fetcher: async (_input, init) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await delay(2); inFlight--;
    if (++attempts === 1) return new Response('', { status: 429 });
    return Response.json({ jsonrpc: '2.0', id: JSON.parse(String(init?.body)).id, result: '0x1' });
  } });
  assert.deepEqual(await Promise.all([rpc.request('eth_chainId'), rpc.request('eth_blockNumber')]), ['0x1', '0x1']);
  assert.equal(attempts, 3); assert.equal(peak, 1);
});

test('cancellation aborts retry waiting immediately without another request', async () => {
  const controller = new AbortController(); let requests = 0;
  const rpc = new Rpc('https://rpc.invalid', controller.signal, { fetcher: async () => { requests++; setTimeout(() => controller.abort(), 10); return new Response('', { status: 429 }); } });
  await assert.rejects(rpc.request('eth_blockNumber'), { name: 'AbortError' });
  assert.equal(requests, 1);
});

test('malformed RPC responses do not become a usable result', async () => {
  const rpc = new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: async () => Response.json({ jsonrpc: '2.0', id: 999, result: null }) });
  await assert.rejects(rpc.request('eth_blockNumber'), error => error instanceof RpcError && error.kind === 'invalid');
});

test('archive restrictions and HTTP 400 range errors are classified separately from credentials', async () => {
  const make = (message: string, status: number) => new Rpc('https://rpc.invalid', new AbortController().signal, { fetcher: async () => Response.json({ error: { code: 35, message } }, { status }) });
  await assert.rejects(make('ranges over 10000 blocks are not supported on free plan', 400).request('eth_getLogs'), error => error instanceof RpcError && error.kind === 'range');
  await assert.rejects(make('Archive requests require a personal token', 403).request('eth_getLogs'), error => error instanceof RpcError && error.kind === 'access' && error.message.includes('archive'));
});
