import { useEffect, useState } from 'react';
import { avatarStyle, ethereumIconURL, icons, tokenIconURL } from './icons.ts';
import type { Token } from './types.ts';

function Artwork({ remote, local, fallback, className, color }: { remote: string | null; local?: string; fallback: string; className: string; color?: string }) {
  const source = local ?? remote;
  const [loaded, setLoaded] = useState<{ source: string | null; image: string | null }>({ source: null, image: null });
  useEffect(() => {
    let active = true;
    if (local) setLoaded({ source, image: local });
    else if (remote) void icons.load(remote).then(image => { if (active) setLoaded({ source, image }); });
    return () => { active = false; };
  }, [source, local, remote]);
  const image = loaded.source === source ? loaded.image : null;
  return <span className={className} style={color ? { background: color } : undefined} aria-hidden="true">{image ? <img src={image} alt="" referrerPolicy="no-referrer" onError={() => { if (!local && remote) icons.reject(remote); setLoaded({ source, image: null }); }}/> : fallback}</span>;
}

const localTokens: Record<string, string> = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': '/icons/weth.webp',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': '/icons/usdc.webp',
};
export function TokenAvatar({ token, chainId, demo }: { token: Token; chainId: number; demo?: boolean }) {
  const style = avatarStyle(token.symbol);
  return <Artwork className="token-icon" fallback={style.glyph} color={style.color} local={demo && chainId === 1 ? localTokens[token.address.toLowerCase()] : undefined} remote={demo ? null : tokenIconURL(chainId, token.address)}/>;
}
export function NetworkAvatar({ name, iconURL, demo }: { name: string; iconURL: string; demo?: boolean }) {
  return <Artwork className="chain-icon" fallback={Array.from(name)[0]?.toUpperCase() ?? '?'} local={demo && iconURL === ethereumIconURL ? '/icons/ethereum.png' : undefined} remote={demo ? null : iconURL}/>;
}
export const ethereumArtwork = { name: 'Ethereum', id: 1, iconURL: ethereumIconURL };
