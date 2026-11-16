import type { Address } from 'viem';
import { loadPortfolio } from './portfolio.ts';
import { networkById, rpcEndpoint, validSelection } from './networks.ts';
import { RequestBudget, RpcError } from './rpc.ts';
import type { ChainState, Progress, Snapshot, StorageLike } from './types.ts';

export const positionKey = (wallet: string, chainId: number, version: 3 | 4, id: string) => `${wallet.toLowerCase()}:${chainId}:v${version}:${id}`;

export async function loadNetworks(options: {
  wallet: Address; networkIds: number[]; publicRPC: boolean; key: string;
  signal: AbortSignal; storage: StorageLike | null; previous?: Snapshot | null;
  update: (snapshot: Snapshot) => void; progress: (progress: Progress) => void;
  fetcher?: typeof fetch; budget?: RequestBudget; creditsPerSecond?: number;
}): Promise<Snapshot> {
  if (!validSelection(options.networkIds)) throw new RpcError('Select at least one supported network.', 'invalid');
  const budget = options.budget ?? new RequestBudget(options.creditsPerSecond);
  const previous = options.previous && !options.previous.demo && options.previous.wallet.toLowerCase() === options.wallet.toLowerCase() ? options.previous : null;
  const states: ChainState[] = options.networkIds.map(chainId => {
    const old = previous?.chains?.find(s => s.chainId === chainId);
    return { chainId, block: old?.block ?? null, updatedAt: old?.updatedAt ?? null, positions: old?.positions ?? [], warnings: [], status: 'loading', complete: false };
  });
  const snapshot = (): Snapshot => ({ wallet: options.wallet, block: '', updatedAt: Date.now(), positions: states.flatMap(s => s.positions),
    complete: states.every(s => s.status === 'ready' && s.complete), warnings: states.flatMap(s => s.warnings.map(w => `${networkById(s.chainId).name}: ${w}`)), chains: states.map(s => ({ ...s })) });
  const publish = () => options.update(snapshot());
  publish();
  await Promise.all(states.map(async (initial, index) => {
    const network = networkById(initial.chainId);
    const old = previous?.chains?.find(s => s.chainId === initial.chainId);
    const retain = (warnings: string[]) => ({ ...initial, status: initial.updatedAt === null ? 'unavailable' as const : 'stale' as const, warnings, complete: false });
    try {
      const endpoint = rpcEndpoint(network, options.publicRPC, options.key);
      if (!endpoint) throw new RpcError('No public RPC is configured for this network.', 'access');
      const result = await loadPortfolio({ ...options, endpoint, chain: network, budget,
        progress: progress => options.progress({ ...progress, phase: `${network.name} · ${progress.phase}`, chainId: network.id, deployment: network.v4Deployment ?? undefined }),
        update: partial => {
          // Keep the previous fixed-block snapshot until the replacement has finished.
          if (!old?.updatedAt) states[index] = { chainId: network.id, block: partial.block, updatedAt: partial.updatedAt, positions: partial.positions, complete: false, status: 'loading', warnings: partial.warnings };
          publish();
        },
      });
      states[index] = !result.complete && old?.updatedAt
        ? retain(['Refresh incomplete. Showing the previous snapshot; values may have changed.', ...new Set([...result.warnings, ...result.positions.flatMap(p => p.errors)])])
        : { chainId: network.id, block: result.block, updatedAt: result.updatedAt, positions: result.positions, complete: result.complete, status: result.complete ? 'ready' : 'partial', warnings: result.warnings };
    } catch (error) {
      const warning = options.signal.aborted ? 'Refresh paused. Refresh to resume saved discovery.' : error instanceof RpcError ? error.message : 'Network reads failed. Refresh to retry.';
      const current = states[index];
      states[index] = current.updatedAt === null || old?.updatedAt ? retain([warning]) : { ...current, status: 'stale', complete: false, warnings: [...current.warnings, warning] };
    }
    publish();
  }));
  return snapshot();
}
