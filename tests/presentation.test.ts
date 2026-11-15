import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feeTier, formatPrice, priceLabelCenter, range, tokenAmount, unclaimedLabel } from '../src/math.ts';
import { demoSnapshot } from '../src/demo.ts';

test('native price and fee formatting retains significant trailing digits and two-digit exponents', () => {
  for (const [input, output] of [[3544.2, '3,544'], [25.957, '25.96'], [.0020612, '0.002061'], [.5, '0.5000'], [.0012, '0.001200'], [0, '0'], [1e-8, '1.00e-08'], [1e9, '1.00e+09']] as const) assert.equal(formatPrice(input), output);
  assert.equal(feeTier(0x800000), 'dynamic fee'); assert.equal(feeTier(500), '0.05%'); assert.equal(feeTier(12345), '1.234%');
  assert.equal(tokenAmount(1.23456789), '1.234568'); assert.equal(tokenAmount(100), '100');
  assert.equal(tokenAmount(1e-18), '<0.000001'); assert.equal(tokenAmount(0), '0'); assert.equal(tokenAmount(null), '—');
});

test('native unclaimed labels distinguish true zero, priced dust, unpriced terms and failed reads', () => {
  const p = demoSnapshot().positions[0];
  for (const feesUSD of [null, 0]) assert.equal(unclaimedLabel({ ...p, fees0: 0, fees1: 0, feesUSD }), 'No unclaimed fees');
  for (const feesUSD of [0, .0001, .004, .009]) assert.equal(unclaimedLabel({ ...p, fees0: .000001, feesUSD }), '<$0.01 fees');
  assert.equal(unclaimedLabel({ ...p, feesUSD: .01 }), '+$0.01 fees');
  assert.equal(unclaimedLabel({ ...p, feesUSD: null, fees0: 1.25, fees1: 0 }), '1.25 USDC');
  assert.equal(unclaimedLabel({ ...p, feesUSD: null, fees0: 0, fees1: 1e-18 }), '<0.000001 WETH');
  assert.equal(unclaimedLabel({ ...p, fees0: null, feesUSD: 12.34 }), 'Fees unavailable');
});

test('native label centres clamp measured and oversized labels without moving the marker', () => {
  for (const [marker, expected] of [[0, 50], [.5, 150], [1, 250]]) assert.equal(priceLabelCenter(marker, 100, 300), expected);
  assert.equal(priceLabelCenter(.1, 180, 120), 60);
  assert.equal(priceLabelCenter(.1, 40, 300), 30);
  assert.equal(priceLabelCenter(.9, 40, 300), 270);
  assert.equal(priceLabelCenter(.1, 40, 0), 0);
});

test('native clamped marker hint, full range and failed pool state preserve display orientation', () => {
  const p = demoSnapshot().positions[0];
  const bounded = { ...p, lower: 0, upper: 100, tick: -1000 };
  const r = range(bounded);
  assert.equal(r.clamped, true); assert.equal(r.marker, 1); assert.equal(r.distance, '10.5% above');
  assert.equal(range({ ...bounded, tick: null }).marker, null);
  assert.equal(range({ ...bounded, lower: -887220, upper: 887220 }).clamped, false);
  const sameSymbol = { ...bounded, token1: { ...p.token1, symbol: p.token0.symbol } };
  assert.equal(range(sameSymbol).inverted, false);
});
