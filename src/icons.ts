const hour = 60 * 60 * 1000;
const week = 7 * 24 * hour;
const hosts = new Set(['token-icons.llamao.fi', 'coin-images.coingecko.com']);

export function tokenIconURL(chainId: number, address: string): string | null {
  if (!Number.isSafeInteger(chainId) || chainId < 1 || !/^0x[0-9a-f]{40}$/i.test(address)) return null;
  return `https://token-icons.llamao.fi/icons/tokens/${chainId}/${address.toLowerCase()}?h=128&w=128`;
}
export const ethereumIconURL = 'https://coin-images.coingecko.com/asset_platforms/images/279/large/ethereum.png';

export function avatarStyle(symbol: string) {
  const s = symbol.toLowerCase();
  if (['eth', 'weth'].includes(s)) return { glyph: 'Ξ', color: 'rgb(36% 42% 84%)' };
  if (['usdc', 'usdc.e', 'usdbc'].includes(s)) return { glyph: '$', color: 'rgb(15% 46% 79%)' };
  if (['usdt', 'usdt0'].includes(s)) return { glyph: '$', color: 'rgb(15% 63% 48%)' };
  if (['wbtc', 'cbbtc', 'btcb', 'tbtc'].includes(s)) return { glyph: '₿', color: 'rgb(91% 51% 10%)' };
  if (s === 'uni') return { glyph: 'U', color: 'rgb(86% 5% 47%)' };
  const colors = ['rgb(36% 40% 47%)', 'rgb(42% 33% 62%)', 'rgb(16% 50% 53%)', 'rgb(62% 36% 24%)'];
  const seed = Array.from(symbol).reduce((sum, scalar) => sum + scalar.codePointAt(0)!, 0);
  const first = new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(symbol)[Symbol.iterator]().next().value?.segment;
  return { glyph: first?.toUpperCase() || '?', color: colors[seed % colors.length] };
}

export class IconCache {
  private entries = new Map<string, { image: string | null; until: number }>();
  private pending = new Map<string, Promise<string | null>>();
  private fetcher: typeof fetch;
  private now: () => number;
  constructor(fetcher: typeof fetch = globalThis.fetch.bind(globalThis), now = Date.now) { this.fetcher = fetcher; this.now = now; }

  load(url: string): Promise<string | null> {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return Promise.resolve(null); }
    if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname) || parsed.username || parsed.password) return Promise.resolve(null);
    const cached = this.entries.get(url);
    if (cached && cached.until > this.now()) return Promise.resolve(cached.image);
    const pending = this.pending.get(url);
    if (pending) return pending;
    const work = this.fetchImage(url).finally(() => { this.pending.delete(url); });
    this.pending.set(url, work);
    return work;
  }

  reject(url: string) {
    const previous = this.entries.get(url)?.image;
    if (previous) URL.revokeObjectURL(previous);
    this.entries.set(url, { image: null, until: this.now() + hour });
  }

  private async fetchImage(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let retry = hour;
    try {
      const response = await this.fetcher(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (response.status === 404) retry = week;
      if (!response.ok || !/^image\/(png|webp|jpeg|gif|avif)(;|$)/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Artwork unavailable');
      const blob = await response.blob();
      if (!blob.size || blob.size > 1024 * 1024) throw new Error('Artwork unavailable');
      const image = URL.createObjectURL(blob);
      this.entries.set(url, { image, until: Infinity });
      return image;
    } catch {
      this.entries.set(url, { image: null, until: this.now() + retry });
      return null;
    } finally { clearTimeout(timer); }
  }
}
export const icons = new IconCache();
