import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { PositionCard } from '../src/App.tsx';
import { ethereumArtwork, NetworkAvatar, TokenAvatar } from '../src/Avatar.tsx';
import { demoSnapshot } from '../src/demo.ts';
import { applyTheme } from '../src/theme.ts';
import type { Theme } from '../src/theme.ts';
import '../src/style.css';

const p = demoSnapshot().positions[0];
const long = { ...p, id: 'fixture-long', lower: 0, upper: 100, tick: -1000, feesUSD: .0001,
  token0: { ...p.token0, symbol: 'BASE' }, token1: { ...p.token1, symbol: 'QUOTE_WITH_A_VERY_LONG_SYMBOL_123456789012' } };
const unknown = { ...p, id: 'fixture-unknown', tick: null, fees0: null, fees1: null, feesUSD: null, valueUSD: null,
  token0: { ...p.token0, decimals: null }, errors: ['Fictional unavailable pool/metadata read.'] };
applyTheme('light');
function Fixtures() {
  const [theme, setTheme] = useState<Theme>('light');
  const [large, setLarge] = useState(false);
  return <main className={`app-shell ${large ? "fixture-large" : ""}`}><style>{`.fixture-large .pair {font-size:32px}.fixture-large .caption,.fixture-large .range-heading,.fixture-large .price-badge,.fixture-large .range-bounds,.fixture-large .distance,.fixture-large .status,.fixture-large .position-value>span,.fixture-large .metric>span {font-size:24px}.fixture-large .position-value>strong {font-size:36px}`}</style><h1>Fictional presentation fixtures</h1><p className="field-note">Development only · no wallet, RPC key or transactions</p>
    <label className="appearance-row">Appearance<select value={theme} onChange={event => { const next = event.target.value as Theme; setTheme(next); applyTheme(next); }}><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/> 200% financial text fixture</label>
    <h2>Live public artwork</h2><div className="token-pair" aria-label="Remote WETH and USDC artwork"><TokenAvatar token={p.token1} chainId={1}/><TokenAvatar token={p.token0} chainId={1}/><NetworkAvatar name={ethereumArtwork.name} iconURL={ethereumArtwork.iconURL}/></div>
    <h2>Oversized price and dust</h2><PositionCard position={long} demo/>
    <h2>Unavailable state</h2><PositionCard position={unknown} demo/>
    <h2>Full range</h2><PositionCard position={{ ...p, id: 'fixture-full', lower: -887220, upper: 887220 }} demo/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixtures/>);
