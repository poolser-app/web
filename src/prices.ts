import { zeroAddress } from 'viem';
import type { Address } from 'viem';
import { chain } from './contracts.ts';
import { aborted } from './rpc.ts';

export const priceAddress = (address: Address) => address === zeroAddress ? chain.wrappedNative.toLowerCase() : address.toLowerCase();

export class Prices {
  signal: AbortSignal;
  warnings = new Set<string>();
  private cache = new Map<string, { price: number; at: number }>();
  private fetcher: typeof fetch;
  constructor(signal: AbortSignal, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) { this.signal = signal; this.fetcher = fetcher; }

  private async json(url: string): Promise<unknown> {
    const controller = new AbortController();
    const stop = () => controller.abort(this.signal.reason);
    this.signal.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      aborted(this.signal);
      const response = await this.fetcher(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Price source unavailable');
      return await response.json();
    } finally { clearTimeout(timer); this.signal.removeEventListener('abort', stop); }
  }

  async get(addresses: Address[]): Promise<Map<string, number>> {
    const unique = [...new Set(addresses.map(priceAddress))];
    const result = new Map<string, number>();
    const missing: string[] = [];
    for (const address of unique) {
      const cached = this.cache.get(address);
      if (cached && Date.now() - cached.at < 55000) result.set(address, cached.price);
      else missing.push(address);
    }
    const store = (address: string, price: unknown) => {
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return;
      result.set(address, price); this.cache.set(address, { price, at: Date.now() });
    };
    for (let start = 0; start < missing.length; start += 25) {
      const part = missing.slice(start, start + 25);
      try {
        const data = await this.json(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${part.join(',')}&vs_currencies=usd`) as Record<string, { usd?: number }>;
        for (const address of part) store(address, data?.[address]?.usd);
      } catch { aborted(this.signal); this.warnings.add('CoinGecko prices are unavailable; the fallback source is being used.'); }
      const remaining = part.filter(address => !result.has(address));
      if (remaining.length) {
        try {
          const data = await this.json(`https://coins.llama.fi/prices/current/${remaining.map(a => `ethereum:${a}`).join(',')}`) as { coins?: Record<string, { price?: number }> };
          for (const address of remaining) store(address, data?.coins?.[`ethereum:${address}`]?.price);
        } catch { aborted(this.signal); this.warnings.add('USD price services could not be reached. Token amounts remain available.'); }
      }
    }
    return result;
  }
}
