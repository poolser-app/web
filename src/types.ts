import type { Address } from 'viem';

export type Token = { address: Address; symbol: string; decimals: number | null; price: number | null };
export type Position = {
  id: string;
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
};
export type Progress = { phase: string; scanned?: bigint; head?: bigint; candidates?: number };
export type ScanCache = { schema: 1; nextBlock: string; candidates: string[]; chunkSize: number };
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
