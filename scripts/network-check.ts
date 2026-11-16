import { supportedNetworks } from '../src/networks.ts';
import { loadNetworks } from '../src/monitor.ts';

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 180000);
const stop = () => controller.abort();
process.on('SIGINT', stop);
const reported = new Set<number>();
try {
  const result = await loadNetworks({ wallet: '0x0000000000000000000000000000000000001234', networkIds: supportedNetworks.map(n => n.id),
    signal: controller.signal, publicRPC: true, key: '', storage: null, progress: () => {}, update: snapshot => {
      for (const state of snapshot.chains ?? []) {
        if (state.status === 'loading' || reported.has(state.chainId)) continue;
        reported.add(state.chainId);
        console.log(JSON.stringify({ chain: state.chainId, status: state.status, block: state.block, positions: state.positions.length, complete: state.complete, warnings: state.warnings }));
      }
    } });
  console.log(JSON.stringify({ complete: result.complete, ready: result.chains?.filter(s => s.status === 'ready').length, unavailable: result.chains?.filter(s => s.status === 'unavailable').length, walletStored: false, credentialsUsed: false }));
  if (!result.complete) process.exitCode = 1;
} catch {
  console.error('Public network validation could not finish. No credentials or wallet configuration were saved.');
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  process.removeListener('SIGINT', stop);
}
