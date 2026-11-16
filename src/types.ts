import type { Address } from 'viem';

export type Token = { address: Address; symbol: string; decimals: number | null; price: number | null };
export type Position = {
  id: string;
  chainId: number;
  version: 3 | 4;
  token0: Token;
  token1: Token;
  fee: number;
  lower: number;
  upper: number;
  tick: number | null;
  liquidity: string;
  amount0: number | null;
  amount1: number | null;
  fees0: number | null;
  fees1: number | null;
  valueUSD: number | null;
  feesUSD: number | null;
  errors: string[];
};
export type Snapshot = {
  wallet: Address;
  block: string;
  updatedAt: number;
  positions: Position[];
  complete: boolean;
  warnings: string[];
  demo?: boolean;
  chains?: ChainState[];
};
export type ChainState = { chainId: number; block: string | null; updatedAt: number | null; status: 'loading' | 'ready' | 'partial' | 'stale' | 'unavailable'; positions: Position[]; complete: boolean; warnings: string[] };
export type Progress = { phase: string; chainId?: number; deployment?: bigint; scanned?: bigint; head?: bigint; candidates?: number };
export type ScanCache = { schema: 1; nextBlock: string; candidates: string[]; chunkSize: number };
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
