import { zeroAddress } from 'viem';
import { chain } from './contracts.ts';
import type { Position, Snapshot, Token } from './types.ts';

const usdc: Token = { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, price: 1 };
const eth: Token = { address: chain.wrappedNative, symbol: 'WETH', decimals: 18, price: 3200 };
const sample = (version: 3 | 4, lowerPrice: number, upperPrice: number): Position => ({
  id: `demo-${version}`, version, token0: usdc, token1: eth, fee: 500,
  lower: Math.round(Math.log(1e12 / upperPrice) / Math.log(1.0001)), upper: Math.round(Math.log(1e12 / lowerPrice) / Math.log(1.0001)),
  tick: Math.round(Math.log(1e12 / 3200) / Math.log(1.0001)), liquidity: '1000000000000000000',
  amount0: version === 3 ? 4200 : 1600, amount1: version === 3 ? 1.5 : 0,
  fees0: version === 3 ? 18.4 : 3.2, fees1: version === 3 ? .007 : .001,
  valueUSD: version === 3 ? 9000 : 1600, feesUSD: version === 3 ? 40.8 : 6.4, errors: [],
});

export function demoSnapshot(): Snapshot {
  return { wallet: zeroAddress, block: '0', updatedAt: Date.now(), complete: true, demo: true, warnings: [], positions: [sample(3, 2800, 3600), sample(4, 2400, 3000)] };
}
