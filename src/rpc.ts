import { decodeFunctionResult, encodeFunctionData, toHex } from 'viem';
import type { Abi, Address, Hex } from 'viem';
import { chain, multicallAbi } from './contracts.ts';
import type { Network } from './networks.ts';

export class RpcError extends Error {
  kind: 'revert' | 'range' | 'transient' | 'access' | 'invalid';
  constructor(message: string, kind: RpcError['kind']) { super(message); this.kind = kind; }
}

export function aborted(signal?: AbortSignal) { signal?.throwIfAborted(); }
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  aborted(signal);
  return new Promise((resolve, reject) => {
    const stop = () => { clearTimeout(timer); reject(signal?.reason ?? new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
}

export class RequestBudget {
  private nextAt = 0;
  private queue: Promise<void> = Promise.resolve();
  private creditsPerSecond: number;
  constructor(creditsPerSecond = 400) { this.creditsPerSecond = creditsPerSecond; }
  async run<T>(credits: number, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    try {
      await previous;
      await delay(Math.max(0, this.nextAt - Date.now()), signal);
      this.nextAt = Date.now() + credits / this.creditsPerSecond * 1000;
      aborted(signal);
      return await work();
    } finally { release(); }
  }
}

export class Rpc {
  private endpoint: string;
  signal: AbortSignal;
  private fetcher: typeof fetch;
  private queue: Promise<void> = Promise.resolve();
  private id = 0;
  private budget: RequestBudget;

  constructor(endpoint: string, signal: AbortSignal, options: { fetcher?: typeof fetch; creditsPerSecond?: number; budget?: RequestBudget } = {}) {
    this.endpoint = endpoint;
    this.signal = signal;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.budget = options.budget ?? new RequestBudget(options.creditsPerSecond);
  }

  async request<T>(method: 'eth_call' | 'eth_getLogs' | 'eth_blockNumber' | 'eth_chainId', params: unknown[] = []): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    try {
      await previous;
      for (let attempt = 0; ; attempt++) {
        aborted(this.signal);
        try { return await this.budget.run(method === 'eth_getLogs' ? 255 : 80, this.signal, () => this.send<T>(method, params)); }
        catch (error) {
          aborted(this.signal);
          if (!(error instanceof RpcError) || error.kind !== 'transient' || attempt >= 3) throw error;
          await delay(800 * 2 ** attempt, this.signal);
        }
      }
    } finally { release(); }
  }

  private async send<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const stop = () => controller.abort(this.signal.reason);
    this.signal.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => controller.abort(), 20000);
    const id = ++this.id;
    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer',
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) throw new RpcError('RPC is busy or rate-limited. Try again shortly.', 'transient');
      // Some providers return useful JSON-RPC range errors with HTTP 400/403.
      const data = await response.json().catch(() => null);
      if (data?.error) {
        const message = String(data.error.message ?? '').toLowerCase();
        if (data.error.code === 3 || message.includes('revert')) throw new RpcError('Contract read reverted.', 'revert');
        if (/range|too many results|response size|gas required|gas limit/.test(message)) throw new RpcError('RPC block range or batch is too large.', 'range');
        if (/archive|personal token|paid plan|upgrade/.test(message)) throw new RpcError('This provider requires archive access for historical logs. Use an RPC project with archive-log access.', 'access');
        if (data.error.code === -32005 || /rate|credits|capacity|try again|timeout/.test(message)) throw new RpcError('RPC request limit reached. Try again shortly.', 'transient');
        if (/auth|access|key|project|origin/.test(message)) throw new RpcError('RPC access denied. Check the API key, enabled network and project origin settings.', 'access');
        throw new RpcError('The RPC provider could not complete this read.', 'invalid');
      }
      if (response.status === 401 || response.status === 403) throw new RpcError('RPC access denied. Check the API key, enabled network and allowed origins.', 'access');
      if (!response.ok) throw new RpcError(`RPC request was rejected (HTTP ${response.status}). Check your provider settings.`, 'invalid');
      if (data?.id !== id || data?.jsonrpc !== '2.0' || !Object.hasOwn(data, 'result') || data.result === null) throw new RpcError('RPC returned an invalid or unavailable result.', 'invalid');
      return data.result as T;
    } catch (error) {
      aborted(this.signal);
      if (error instanceof RpcError) throw error;
      // Never expose fetch/ABI error strings: they can contain the credential-bearing RPC URL.
      throw new RpcError('RPC could not be reached. Check your connection and the project’s browser-origin settings.', 'transient');
    } finally {
      clearTimeout(timer);
      this.signal.removeEventListener('abort', stop);
    }
  }
}

export type Call = { to: Address; abi: Abi; name: string; args?: readonly unknown[] };
export type ReadResult = { ok: true; value: unknown } | { ok: false; error: RpcError };
export const call = (to: Address, abi: Abi, name: string, args: readonly unknown[] = []): Call => ({ to, abi, name, args });
const encoded = (c: Call) => encodeFunctionData({ abi: c.abi, functionName: c.name, args: c.args });
const decoded = (c: Call, data: Hex) => decodeFunctionResult({ abi: c.abi, functionName: c.name, data });

export class Reader {
  rpc: Rpc;
  block: bigint;
  chain: Network;
  constructor(rpc: Rpc, block: bigint, network: Network = chain) { this.rpc = rpc; this.block = block; this.chain = network; }

  async one<T>(c: Call, from?: Address): Promise<T> {
    const data = await this.rpc.request<Hex>('eth_call', [{ to: c.to, data: encoded(c), ...(from ? { from } : {}) }, toHex(this.block)]);
    try { return decoded(c, data) as T; }
    catch { throw new RpcError(`${c.name} returned unreadable data.`, 'invalid'); }
  }

  async batch(calls: Call[]): Promise<ReadResult[]> {
    const results: ReadResult[] = [];
    for (let i = 0; i < calls.length; i += 80) results.push(...await this.chunk(calls.slice(i, i + 80)));
    return results;
  }

  private async chunk(calls: Call[]): Promise<ReadResult[]> {
    if (!calls.length) return [];
    if (!this.chain.multicall) {
      const results: ReadResult[] = [];
      for (const c of calls) {
        try { results.push({ ok: true, value: await this.one(c) }); }
        catch (error) { aborted(this.rpc.signal); results.push({ ok: false, error: error instanceof RpcError ? error : new RpcError('Read unavailable.', 'invalid') }); }
      }
      return results;
    }
    try {
      const data = await this.one<readonly { success: boolean; returnData: Hex }[]>(call(this.chain.multicall!, multicallAbi, 'aggregate3', [calls.map(c => ({ target: c.to, allowFailure: true, callData: encoded(c) }))]));
      if (data.length !== calls.length) throw new RpcError('Incomplete multicall response.', 'invalid');
      return data.map((item, index) => {
        if (!item.success) return { ok: false, error: new RpcError('Contract read reverted.', 'revert') };
        try { return { ok: true, value: decoded(calls[index], item.returnData) }; }
        catch { return { ok: false, error: new RpcError(`${calls[index].name} returned unreadable data.`, 'invalid') }; }
      });
    } catch (error) {
      aborted(this.rpc.signal);
      if (error instanceof RpcError && (error.kind === 'range' || error.kind === 'revert') && calls.length > 1) {
        const middle = Math.floor(calls.length / 2);
        return [...await this.chunk(calls.slice(0, middle)), ...await this.chunk(calls.slice(middle))];
      }
      if (calls.length === 1 && error instanceof RpcError && (error.kind === 'range' || error.kind === 'revert')) {
        try { return [{ ok: true, value: await this.one(calls[0]) }]; }
        catch (single) { aborted(this.rpc.signal); return [{ ok: false, error: single instanceof RpcError ? single : new RpcError('Read unavailable.', 'invalid') }]; }
      }
      const safe = error instanceof RpcError ? error : new RpcError('Contract reads are unavailable.', 'invalid');
      return calls.map(() => ({ ok: false, error: safe }));
    }
  }
}

export function value<T>(result: ReadResult | undefined): T | null { return result?.ok ? result.value as T : null; }
