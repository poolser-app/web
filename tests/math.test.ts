import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zeroAddress } from 'viem';
import { amounts, decodeTicks, feeGrowthInside, formatPrice, poolId, priced, Q128, range, sub256, unclaimedFee, usd } from '../src/math.ts';
import { totals } from '../src/portfolio.ts';
import { demoSnapshot } from '../src/demo.ts';
import { chain } from '../src/contracts.ts';

test('native uint256 fixtures: wrapping, high accumulators and borrow propagation', () => {
  assert.equal(sub256(0n, 1n), (1n << 256n) - 1n);
  assert.equal(sub256(1n << 255n, 1n << 255n), 0n);
  assert.equal(sub256(1n << 248n, 1n), (1n << 248n) - 1n);
  assert.equal(sub256(feeGrowthInside(100n, 150n, 20n, 0, -200, 200), sub256(0n, 100n)), 30n);
  const huge = 1n << 200n;
  assert.equal(unclaimedFee(huge + 30n, 0n, 0n, huge, 3n * Q128, 0, -100, 100), 90n);
});

test('fee growth follows below/inside/above tick branches, including the exclusive upper bound', () => {
  assert.equal(feeGrowthInside(100n, 40n, 10n, -201, -200, 200), 30n);
  assert.equal(feeGrowthInside(100n, 40n, 10n, -200, -200, 200), 50n);
  assert.equal(feeGrowthInside(100n, 40n, 10n, 199, -200, 200), 50n);
  assert.equal(feeGrowthInside(100n, 40n, 10n, 200, -200, 200), sub256(10n, 40n));
});

test('native v4 pool identity and signed packed-position fixtures', () => {
  const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  assert.equal(poolId({ currency0: zeroAddress, currency1: usdc, fee: 500, tickSpacing: 10, hooks: zeroAddress }), '0x21c67e77068de97969ba93d4aab21826d33ca12bb9f565d8496e8fda8a82ca27');
  assert.equal(poolId({ currency0: usdc, currency1: chain.wrappedNative, fee: 500, tickSpacing: 10, hooks: zeroAddress }), '0x4f88f7c99022eace4740c6898f59ce6a2e798a1e64ce54589720b7153eb224a7');
  assert.deepEqual(decodeTicks(BigInt('0x4f88f7c99022eace4740c6898f59ce6a2e798a1e64ce5458970d89e6f2761a00')), { lower: -887270, upper: 887270 });
  assert.deepEqual(decodeTicks(BigInt('0x' + '11'.repeat(25) + '0d89b4f2764c01')), { lower: -887220, upper: 887220 });
});

test('native amount fixtures match below/inside/above range and token decimal scaling', () => {
  const q = (s: number) => BigInt(Math.floor(s * 2 ** 96));
  const liq = 10n ** 18n, b = 1.0001 ** (13864 / 2);
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(Math.abs(actual), Math.abs(expected), 1e-30));
  const below = amounts(liq, q(.5), 0, 13864, 18, 18);
  close(below[0], 1 - 1 / b); assert.equal(below[1], 0);
  const above = amounts(liq, q(3), 0, 13864, 18, 18);
  assert.equal(above[0], 0); close(above[1], b - 1);
  const inside = amounts(liq, q(1.5), 0, 13864, 6, 18);
  close(inside[0], 1e12 * (1 / 1.5 - 1 / b)); close(inside[1], .5);
  assert.equal(priced(...[inside[0], 2, inside[1], 3] as const), inside[0] * 2 + inside[1] * 3);
  assert.deepEqual(amounts(0n, q(1), 0, 13864, 18, 18), [0, 0]);
});

test('range semantics match native quote priority, 3% edges, full range and exclusive max', () => {
  const p = demoSnapshot().positions[0];
  const base = { ...p, lower: -200, upper: 200 };
  for (const [tick, expected] of [[-201, 'outOfRange'], [-200, 'nearEdge'], [0, 'inRange'], [199, 'nearEdge'], [200, 'outOfRange']]) {
    assert.equal(range({ ...base, tick: tick as number }).status, expected);
  }
  assert.equal(range({ ...base, tick: -200 }).title, 'Near max');
  assert.equal(range({ ...base, tick: 199 }).title, 'Near min');
  assert.equal(range(p).base, 'WETH'); assert.equal(range(p).quote, 'USDC');
  assert.equal(range({ ...base, tick: null }).status, 'unknown');
  const full = range({ ...base, lower: -887200, upper: 887200, tick: 0 });
  assert.equal(full.min, 0); assert.equal(full.max, Infinity); assert.equal(full.status, 'fullRange');
  assert.ok(range({ ...base, tick: -100000 }).marker! <= 1);
});

test('missing prices/reads never become zero and positive dust is not rounded away', () => {
  assert.equal(priced(1, null, 0, null), null);
  assert.equal(priced(null, 1, 0, 1), null);
  assert.equal(priced(0, null, 0, null), 0);
  assert.equal(priced(1, 2, 0, null), 2);
  assert.equal(usd(.000001), '<$0.01'); assert.equal(usd(null), '—');
  assert.notEqual(formatPrice(1e-15), '0');
  const s = demoSnapshot();
  s.complete = false; s.positions = [];
  assert.deepEqual(totals(s, 'feesUSD'), { value: null, partial: true, unknown: 0 });
  s.complete = true;
  assert.deepEqual(totals(s, 'feesUSD'), { value: 0, partial: false, unknown: 0 });
  s.positions = [{ ...demoSnapshot().positions[0], feesUSD: null }];
  assert.deepEqual(totals(s, 'feesUSD'), { value: null, partial: true, unknown: 1 });
});
