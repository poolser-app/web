import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import type { Address } from 'viem';
import type { Position } from './types.ts';

const MOD = 1n << 256n;
export const Q128 = 1n << 128n;
export const sub256 = (a: bigint, b: bigint) => ((a - b) % MOD + MOD) % MOD;

export function feeGrowthInside(global: bigint, lo: bigint, hi: bigint, tick: number, lower: number, upper: number): bigint {
  const below = tick >= lower ? lo : sub256(global, lo);
  const above = tick < upper ? hi : sub256(global, hi);
  return sub256(sub256(global, below), above);
}

export function unclaimedFee(global: bigint, lo: bigint, hi: bigint, last: bigint, liquidity: bigint, tick: number, lower: number, upper: number): bigint {
  // Keep accumulators and their wrapping subtraction exact; convert only final token amounts.
  return sub256(feeGrowthInside(global, lo, hi, tick, lower, upper), last) * liquidity / Q128;
}

export function decodeTicks(info: bigint): { lower: number; upper: number } {
  const signed = (word: bigint) => Number(BigInt.asIntN(24, word & 0xffffffn));
  return { lower: signed(info >> 8n), upper: signed(info >> 32n) };
}

export function poolId(key: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }) {
  return keccak256(encodeAbiParameters(parseAbiParameters('address, address, uint24, int24, address'),
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]));
}

export function amounts(liquidity: bigint, sqrtX96: bigint, lower: number, upper: number, decimals0: number, decimals1: number): [number, number] {
  if (liquidity === 0n) return [0, 0];
  if (sqrtX96 <= 0n || lower >= upper) throw new Error('Pool price or range is unavailable.');
  // Match native computeAmounts: floating point is used only for display amounts and USD.
  const l = Number(liquidity), s = Number(sqrtX96) / 2 ** 96;
  const a = Math.exp(lower * Math.log(1.0001) / 2), b = Math.exp(upper * Math.log(1.0001) / 2);
  return [
    (s <= a ? l * (1 / a - 1 / b) : s >= b ? 0 : l * (1 / s - 1 / b)) / 10 ** decimals0,
    (s >= b ? l * (b - a) : s <= a ? 0 : l * (s - a)) / 10 ** decimals1,
  ];
}

export function priced(a: number | null, priceA: number | null, b: number | null, priceB: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if ((a > 0 && priceA === null) || (b > 0 && priceB === null)) return null;
  const result = a * (priceA ?? 0) + b * (priceB ?? 0);
  return Number.isFinite(result) ? result : null;
}

const quotePriority = ['usdc', 'usdt', 'dai', 'usdc.e', 'usdbc', 'usdt0', 'pyusd', 'usds', 'frax', 'lusd', 'weth', 'eth', 'wbtc', 'cbbtc', 'btcb'];
export function range(p: Pick<Position, 'token0' | 'token1' | 'lower' | 'upper' | 'tick'>) {
  const rank = (s: string) => { const i = quotePriority.indexOf(s.toLowerCase()); return i < 0 ? Infinity : i; };
  const inverted = rank(p.token0.symbol) < rank(p.token1.symbol);
  const base = inverted ? p.token1.symbol : p.token0.symbol, quote = inverted ? p.token0.symbol : p.token1.symbol;
  const full = p.lower <= -887200 && p.upper >= 887200;
  const hasDecimals = p.token0.decimals !== null && p.token1.decimals !== null;
  const price = (tick: number) => {
    const direct = Math.exp(tick * Math.log(1.0001)) * 10 ** ((p.token0.decimals ?? 0) - (p.token1.decimals ?? 0));
    return inverted ? 1 / direct : direct;
  };
  let status: 'unknown' | 'fullRange' | 'outOfRange' | 'nearEdge' | 'inRange' = 'unknown';
  let title = 'Range unknown';
  if (full) { status = 'fullRange'; title = 'Full range'; }
  else if (p.tick !== null) {
    if (p.tick < p.lower || p.tick >= p.upper) { status = 'outOfRange'; title = 'Out of range'; }
    else {
      const f = (p.tick - p.lower) / Math.max(p.upper - p.lower, 1);
      status = f < .03 || f > .97 ? 'nearEdge' : 'inRange';
      title = f < .03 ? (inverted ? 'Near max' : 'Near min') : f > .97 ? (inverted ? 'Near min' : 'Near max') : 'In range';
    }
  }
  let bandStart = 0, bandEnd = 1, marker: number | null = null;
  if (p.tick !== null) {
    const span = Math.max(p.upper - p.lower, 1);
    let lo = Math.max(Math.min(p.lower, p.tick), p.lower - 1.5 * span);
    let hi = Math.min(Math.max(p.upper, p.tick), p.upper + 1.5 * span);
    const padding = (hi - lo) * .1; lo -= padding; hi += padding;
    bandStart = full ? 0 : (p.lower - lo) / (hi - lo);
    bandEnd = full ? 1 : (p.upper - lo) / (hi - lo);
    marker = Math.min(1, Math.max(0, full ? (p.tick - p.lower) / span : (p.tick - lo) / (hi - lo)));
    if (inverted) { [bandStart, bandEnd] = [1 - bandEnd, 1 - bandStart]; marker = 1 - marker; }
  }
  let distance: string | null = null;
  if (p.tick !== null && status === 'outOfRange') {
    const below = p.tick < p.lower;
    const exponent = (below ? p.lower - p.tick : p.tick - p.upper) * Math.log(1.0001);
    const direction = below !== inverted ? 'below' : 'above';
    const pct = Math.expm1(exponent) * 100;
    distance = exponent > Math.log(1000) ? `far ${direction}` : `${pct.toFixed(pct >= 100 ? 0 : 1)}% ${direction}`;
  }
  return { base, quote, status, title, bandStart, bandEnd, marker, distance,
    min: full ? 0 : hasDecimals ? Math.min(price(p.lower), price(p.upper)) : null,
    max: full ? Infinity : hasDecimals ? Math.max(price(p.lower), price(p.upper)) : null,
    current: p.tick !== null && hasDecimals ? price(p.tick) : null };
}

export function formatPrice(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return '∞';
  if (n === 0) return '0';
  if (n < 1e-6 || n >= 1e9) return n.toExponential(2);
  return n.toLocaleString('en-US', n >= 1000 ? { maximumFractionDigits: 0 } : n >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 });
}

export function usd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n > 0 && n < .01) return '<$0.01';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
