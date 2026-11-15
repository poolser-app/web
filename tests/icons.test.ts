import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarStyle, ethereumIconURL, IconCache, tokenIconURL } from '../src/icons.ts';

const token = '0x0000000000000000000000000000000000000011';
const image = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });

test('native icon identity includes chain and address; fallback style is deterministic and Unicode-safe', () => {
  assert.notEqual(tokenIconURL(1, token), tokenIconURL(8453, token));
  assert.equal(tokenIconURL(1, 'invalid'), null); assert.equal(tokenIconURL(-1, token), null);
  assert.equal(tokenIconURL(1, token.toUpperCase().replace('0X', '0x')), tokenIconURL(1, token));
  assert.equal(avatarStyle('WETH').glyph, 'Ξ'); assert.equal(avatarStyle('USDbC').glyph, '$');
  assert.equal(avatarStyle('cbBTC').glyph, '₿'); assert.equal(avatarStyle('UNI').glyph, 'U');
  assert.deepEqual(avatarStyle('👩‍💻'), avatarStyle('👩‍💻')); assert.equal(avatarStyle('👩‍💻').glyph, '👩‍💻');
  assert.notEqual(avatarStyle('AAAA').color, avatarStyle('AAAB').color);
});

test('icon cache deduplicates in-flight and positive reads and omits credentials/referrer', async () => {
  let requests = 0, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const cache = new IconCache(async (_url, init) => {
    requests++; assert.equal(init?.credentials, 'omit'); assert.equal(init?.referrerPolicy, 'no-referrer');
    await wait; return image();
  });
  const one = cache.load(ethereumIconURL), two = cache.load(ethereumIconURL);
  assert.equal(one, two); release();
  const loaded = await one; assert.ok(loaded?.startsWith('blob:'));
  assert.equal(await cache.load(ethereumIconURL), loaded); assert.equal(requests, 1);
  cache.reject(ethereumIconURL); assert.equal(await cache.load(ethereumIconURL), null); assert.equal(requests, 1);
});

test('404 artwork is retried weekly and transient/invalid artwork hourly without throwing', async () => {
  for (const [status, retry] of [[404, 7 * 24 * 60 * 60 * 1000], [500, 60 * 60 * 1000]]) {
    let now = 0, calls = 0;
    const cache = new IconCache(async () => { calls++; return new Response('', { status }); }, () => now);
    assert.equal(await cache.load(ethereumIconURL), null); now = retry - 1;
    assert.equal(await cache.load(ethereumIconURL), null); assert.equal(calls, 1); now++;
    assert.equal(await cache.load(ethereumIconURL), null); assert.equal(calls, 2);
  }
  for (const response of [new Response('<html>'), new Response('x', { headers: { 'content-type': 'image/png', 'content-length': String(2 ** 21) } })]) {
    assert.equal(await new IconCache(async () => response).load(ethereumIconURL), null);
  }
});

test('untrusted artwork URLs never trigger a request', async () => {
  const cache = new IconCache(async () => { assert.fail('unexpected artwork destination'); });
  for (const url of ['https://evil.invalid/a.png', 'http://token-icons.llamao.fi/x', 'https://secret@token-icons.llamao.fi/x', 'not a URL']) assert.equal(await cache.load(url), null);
});

test('pinned demo artwork matches its recorded native source hashes', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const root = new URL('../public/icons/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
  assert.match(manifest.nativeReference, /^[a-f0-9]{40}$/);
  assert.equal(manifest.files.length, 3);
  for (const file of manifest.files) {
    assert.ok(!file.path.includes('/') && !file.path.includes('..'));
    assert.ok(['token-icons.llamao.fi', 'coin-images.coingecko.com'].includes(new URL(file.source).hostname));
    assert.equal(createHash('sha256').update(await readFile(new URL(file.path, root))).digest('hex'), file.sha256);
  }
});
