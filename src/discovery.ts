import { pad, toHex } from 'viem';
import type { Address, Hex } from 'viem';
import { chain, nftAbi, transferTopic } from './contracts.ts';
import { aborted, call, RpcError, value } from './rpc.ts';
import type { Reader } from './rpc.ts';
import type { Progress, ScanCache, StorageLike } from './types.ts';

const key = (wallet: Address) => `poolser:v1:1:v4:${wallet.toLowerCase()}`;
export function readScan(storage: StorageLike | null, wallet: Address): { cache: ScanCache; warning?: string } {
  const empty: ScanCache = { schema: 1, nextBlock: chain.v4Deployment.toString(), candidates: [], chunkSize: 20000 };
  try {
    if (!storage) return { cache: empty, warning: 'Browser storage is unavailable. Scan progress cannot survive a reload.' };
    const raw = storage.getItem(key(wallet));
    if (!raw) return { cache: empty };
    const data = JSON.parse(raw);
    if (data.schema !== 1 || !/^\d+$/.test(data.nextBlock) || BigInt(data.nextBlock) < chain.v4Deployment ||
      !Array.isArray(data.candidates) || !data.candidates.every((id: unknown) => typeof id === 'string' && /^\d+$/.test(id) && BigInt(id) < 1n << 256n) ||
      !Number.isInteger(data.chunkSize) || data.chunkSize < 1 || data.chunkSize > 20000) throw new Error('Invalid cache');
    return { cache: data };
  } catch { return { cache: empty, warning: 'Saved scan progress could not be read. Discovery is starting again.' }; }
}

function saveScan(storage: StorageLike | null, wallet: Address, cache: ScanCache): string | null {
  try { if (!storage) throw new Error('No storage'); storage.setItem(key(wallet), JSON.stringify(cache)); return null; }
  catch { return 'Scan progress could not be saved. Keep this tab open or allow browser storage before reloading.'; }
}

export function scanStart(next: bigint, head: bigint): bigint | null {
  if (next > head + 1n) return null;
  return next > head ? (next - 24n > chain.v4Deployment ? next - 24n : chain.v4Deployment) : next;
}

export async function checkOwners(reader: Reader, ids: string[], wallet: Address): Promise<{ owned: string[]; failed: number }> {
  const results = await reader.batch(ids.map(id => call(chain.v4, nftAbi, 'ownerOf', [BigInt(id)])));
  const owned: string[] = [];
  let failed = 0;
  results.forEach((result, i) => {
    const owner = value<Address>(result);
    if (owner?.toLowerCase() === wallet.toLowerCase()) owned.push(ids[i]);
    if (!result.ok && result.error.kind !== 'revert') failed++;
  });
  return { owned, failed };
}

export async function discoverV4(reader: Reader, wallet: Address, balance: bigint, storage: StorageLike | null, progress: (p: Progress) => void) {
  if (balance === 0n) return { ids: [] as string[], warnings: [] as string[], complete: true };
  const { cache, warning } = readScan(storage, wallet);
  const warnings = new Set<string>(warning ? [warning] : []);
  const candidates = new Set(cache.candidates);
  const head = reader.block;
  const originalNext = BigInt(cache.nextBlock);
  // Recheck a 24-block overlap after every resumed/incremental scan; checkpoints never gap.
  let from = originalNext > chain.v4Deployment ? originalNext - 24n : chain.v4Deployment;
  if (from < chain.v4Deployment) from = chain.v4Deployment;
  if (scanStart(originalNext, head) === null) {
    return { ids: [] as string[], complete: false, warnings: ['The RPC node is behind saved scan progress. Try again when the node has caught up.'] };
  }
  let chunkSize = cache.chunkSize;
  let windows = 0;
  // shortcut: scan at most 120 windows per refresh; resume from checkpoints on restricted providers.
  while (from <= head && windows < 120) {
    aborted(reader.rpc.signal);
    const to = from + BigInt(chunkSize) - 1n < head ? from + BigInt(chunkSize) - 1n : head;
    progress({ phase: 'Discovering v4 positions', scanned: from, head, candidates: candidates.size });
    let logs: { address: string; topics: Hex[]; removed?: boolean }[];
    try {
      logs = await reader.rpc.request('eth_getLogs', [{ address: chain.v4, fromBlock: toHex(from), toBlock: toHex(to), topics: [transferTopic, null, pad(wallet)] }]);
    } catch (error) {
      if (error instanceof RpcError && error.kind === 'range' && chunkSize > 1) { chunkSize = Math.max(1, Math.floor(chunkSize / 2)); continue; }
      throw error;
    }
    if (!Array.isArray(logs)) throw new RpcError('Transfer history returned unreadable data. Progress was not advanced.', 'invalid');
    for (const log of logs) {
      if (log.removed) continue;
      if (log.address?.toLowerCase() !== chain.v4 || !Array.isArray(log.topics) || log.topics.length !== 4 ||
          log.topics[0]?.toLowerCase() !== transferTopic || log.topics[2]?.toLowerCase() !== pad(wallet).toLowerCase() || !/^0x[0-9a-f]{64}$/i.test(log.topics[3])) {
        throw new RpcError('Transfer history returned an unexpected event. Progress was not advanced.', 'invalid');
      }
      candidates.add(BigInt(log.topics[3]).toString());
    }
    from = to + 1n;
    windows++;
    const persist = () => {
      const problem = saveScan(storage, wallet, { schema: 1, nextBlock: from.toString(), candidates: [...candidates], chunkSize });
      if (problem) warnings.add(problem);
    };
    persist();
    progress({ phase: 'Discovering v4 positions', scanned: to, head, candidates: candidates.size });
    // At a fixed block, matching the live NFT balance proves that all currently owned IDs are known.
    if (candidates.size && (windows % 8 === 0 || from > head || windows === 120)) {
      const checked = await checkOwners(reader, [...candidates], wallet);
      if (checked.failed === 0 && BigInt(checked.owned.length) === balance) {
        from = head + 1n; persist();
        return { ids: checked.owned, warnings: [...warnings], complete: true };
      }
    }
  }
  const checked = await checkOwners(reader, [...candidates], wallet);
  if (checked.failed) warnings.add('Some v4 ownership checks failed. They will be retried on refresh.');
  const complete = checked.failed === 0 && BigInt(checked.owned.length) === balance;
  if (from <= head && !complete) warnings.add('v4 discovery paused after 120 log windows. Refresh to continue from the saved block; totals include only positions found so far.');
  if (!complete) warnings.add('v4 ownership does not yet match the on-chain balance. Refresh to retry; totals are incomplete.');
  return { ids: checked.owned, warnings: [...warnings], complete };
}
