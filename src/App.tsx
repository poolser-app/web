import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getAddress, isAddress } from 'viem';
import { formatPrice, range, usd } from './math.ts';
import { loadPortfolio, totals } from './portfolio.ts';
import { RpcError } from './rpc.ts';
import { demoSnapshot } from './demo.ts';
import { publicProvider } from './contracts.ts';
import { applyTheme } from './theme.ts';
import type { Theme } from './theme.ts';
import type { Position, Progress, Snapshot, StorageLike } from './types.ts';

function browserStorage(): StorageLike | null { try { return localStorage; } catch { return null; } }
function rememberedWallet(): string {
  try { const saved = localStorage.getItem('poolser:last-wallet'); return saved && isAddress(saved) ? saved : ''; }
  catch { return ''; }
}
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const tokenAmount = (n: number | null) => n === null ? '—' : n === 0 ? '0' : n.toLocaleString('en-US', { maximumSignificantDigits: 8 });

function Crest() {
  return <div className="crest" aria-hidden="true">
    <svg viewBox="0 0 1000 64" preserveAspectRatio="none"><defs><linearGradient id="crest-gradient"><stop stopColor="#2E82F0"/><stop offset=".55" stopColor="#30B8A6"/><stop offset="1" stopColor="#59CC6B"/></linearGradient></defs><path fill="url(#crest-gradient)" d="M0 0H1000V0H750C570 0 540 57 390 52C140 34 110 63 0 62Z"/></svg>
    <span className="eyes"><i/><i/></span>
  </div>;
}

function PositionCard({ position: p, demo }: { position: Position; demo?: boolean }) {
  const r = range(p);
  const noFees = p.fees0 === 0 && p.fees1 === 0;
  const feeLabel = noFees ? 'No unclaimed fees' : p.feesUSD !== null ? `${usd(p.feesUSD)} fees` : p.fees0 !== null && p.fees1 !== null ? `${tokenAmount(p.fees0)} ${p.token0.symbol} + ${tokenAmount(p.fees1)} ${p.token1.symbol} fees` : 'Fees unavailable';
  const fee = p.fee & 0x800000 ? 'Dynamic fee' : `${p.fee / 10000}% fee`;
  const hasPair = p.token0.decimals !== null || p.token1.decimals !== null;
  return <article className={`position ${r.status}`} aria-label={`${hasPair ? `${r.base}/${r.quote}` : 'Unread position'}, Uniswap v${p.version}, ${r.title}`}>
    <header className="position-header">
      <div><div className="pair">{hasPair ? `${r.base} / ${r.quote}` : 'Position unavailable'}</div><p className="caption">Ethereum <span>·</span> <strong>v{p.version}</strong> <span>·</span> {fee}</p></div>
      <div className="position-value"><strong>{usd(p.valueUSD)}</strong><span className={noFees ? 'quiet' : 'fee-amount'}>{feeLabel}</span></div>
    </header>
    <div className="range-heading"><span>Price range</span><span className="status"><b aria-hidden="true">●</b> {r.title}</span></div>
    <div className="current-price"><span>{r.quote} per {r.base}</span><span>Current <strong>{formatPrice(r.current)}</strong></span></div>
    <div className="range-track" aria-hidden="true">
      <span className="range-band" style={{ left: `${r.bandStart * 100}%`, width: `${(r.bandEnd - r.bandStart) * 100}%` }}/>
      <span className="range-tick" style={{ left: `${r.bandStart * 100}%` }}/><span className="range-tick" style={{ left: `calc(${r.bandEnd * 100}% - 1px)` }}/>
      {r.marker !== null && <span className="range-marker" style={{ left: `clamp(0px, calc(${r.marker * 100}% - 2px), calc(100% - 4px))` }}/>}</div>
    <div className="range-bounds"><span>Min <strong>{formatPrice(r.min)}</strong></span><span>Max <strong>{formatPrice(r.max)}</strong></span></div>
    {r.distance && <p className="distance">{r.distance.endsWith('below') ? '↓' : '↑'} {r.distance} the range</p>}
    {!!p.errors.length && <ul className="read-errors">{p.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <footer className="position-footer"><details><summary>Position details</summary><dl>
      <div><dt>Position ID</dt><dd>{p.id}</dd></div>
      <div><dt>{p.token0.symbol} held</dt><dd>{tokenAmount(p.amount0)}</dd></div><div><dt>{p.token1.symbol} held</dt><dd>{tokenAmount(p.amount1)}</dd></div>
      <div><dt>{p.token0.symbol} unclaimed</dt><dd>{tokenAmount(p.fees0)}</dd></div><div><dt>{p.token1.symbol} unclaimed</dt><dd>{tokenAmount(p.fees1)}</dd></div>
    </dl></details>
    {!demo && !p.id.startsWith('unread-') && <a href={p.version === 4 ? `https://app.uniswap.org/positions/v4/mainnet/${p.id}` : `https://app.uniswap.org/pools/${p.id}?chain=mainnet`} target="_blank" rel="noopener noreferrer">Open in Uniswap <span aria-hidden="true">↗</span></a>}</footer>
  </article>;
}

function Portfolio({ snapshot, busy, stale }: { snapshot: Snapshot; busy: boolean; stale: boolean }) {
  const total = totals(snapshot, 'valueUSD'), fees = totals(snapshot, 'feesUSD');
  return <>
    <section className="portfolio-summary" aria-labelledby="portfolio-title"><Crest/>
      <div className="summary-heading"><div><p className="eyebrow">{snapshot.demo ? 'Fictional demo data' : 'Your portfolio'}</p><h1 id="portfolio-title">{snapshot.demo ? 'A little perspective.' : short(snapshot.wallet)}</h1></div>
        <span className={`read-status ${stale || !snapshot.complete ? 'stale' : ''}`}>{snapshot.demo ? 'Demo portfolio' : stale ? 'Refresh incomplete' : busy ? 'Updating' : snapshot.complete ? 'Read complete' : 'Partial portfolio'}</span></div>
      <div className="summary-metrics"><div><p>{total.partial ? 'Known portfolio value' : 'Portfolio value'}</p><strong>{usd(total.value)}</strong>{total.partial && <small>Partial · some positions are still unknown</small>}</div><div><p>{fees.partial ? 'Known unclaimed fees' : 'Unclaimed fees'}</p><strong className="fee-amount">{usd(fees.value)}</strong>{fees.partial && <small>Partial · some fees are still unknown</small>}</div></div>
      <p className="summary-note">{snapshot.demo ? 'A preview using fictional positions. No network requests or wallet connection.' : <>Read at block {Number(snapshot.block).toLocaleString('en-US')} · Checked {new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}</p>
    </section>
    {!!snapshot.warnings.length && <div className="notices" aria-label="Read notices">{snapshot.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
    <div className="section-heading"><h2>Positions</h2><span className="caption">{snapshot.positions.length} loaded {snapshot.positions.length === 1 ? 'position' : 'positions'}{!snapshot.complete ? ' · discovery incomplete' : ''}</span></div>
    {snapshot.positions.length ? <div className="positions">{snapshot.positions.map(p => <PositionCard key={`${p.version}-${p.id}`} position={p} demo={snapshot.demo}/>)}</div>
      : <section className="empty-positions"><h3>{snapshot.complete ? 'No funded positions found' : busy ? 'Still looking for positions' : 'Portfolio incomplete'}</h3><p>{snapshot.complete ? 'This address has no funded Uniswap v3 or v4 positions on Ethereum at the block checked.' : 'Refresh to retry unavailable reads or resume discovery. Unknown amounts are not treated as zero.'}</p></section>}
  </>;
}

export default function App() {
  const [wallet, setWallet] = useState(rememberedWallet);
  const [key, setKey] = useState('');
  const [publicRpc, setPublicRpc] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const running = useRef<AbortController | null>(null);

  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => applyTheme(theme);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [theme]);
  useEffect(() => () => running.current?.abort(), []);
  useEffect(() => {
    if (snapshot && matchMedia('(max-width: 740px)').matches) document.getElementById('portfolio')?.focus();
  }, [snapshot?.wallet, snapshot?.demo]);

  async function load(event: FormEvent) {
    event.preventDefault();
    setError(''); setMessage('');
    const address = wallet.trim();
    if (!isAddress(address)) { setError('Enter a valid Ethereum address starting with 0x. ENS names are not supported yet.'); return; }
    if (!publicRpc && !/^[a-zA-Z0-9_-]{16,128}$/.test(key.trim())) { setError('Enter your Infura project API key, without a URL or API secret.'); return; }
    running.current?.abort();
    const controller = new AbortController(); running.current = controller;
    if (snapshot?.wallet.toLowerCase() !== address.toLowerCase() || snapshot.demo) setSnapshot(null);
    setBusy(true); setStale(!!snapshot && !snapshot.demo); setProgress(null);
    const storage = browserStorage();
    try { storage?.setItem('poolser:last-wallet', address); } catch { setMessage('This browser could not save the wallet address.'); }
    const current = () => running.current === controller && !controller.signal.aborted;
    try {
      const loaded = await loadPortfolio({ endpoint: publicRpc ? publicProvider.url : `https://mainnet.infura.io/v3/${key.trim()}`, wallet: getAddress(address), signal: controller.signal, storage,
        progress: next => { if (current()) setProgress(next); }, update: next => { if (current()) { setSnapshot(next); setStale(false); } } });
      if (current()) { setSnapshot(loaded); setProgress(null); }
    } catch (failure) {
      if (!controller.signal.aborted && running.current === controller) {
        setError(failure instanceof RpcError ? failure.message : 'Portfolio loading failed. Check your connection and try again.');
        setStale(true);
      }
    } finally { if (running.current === controller) setBusy(false); }
  }

  function demo() {
    running.current?.abort(); setBusy(false); setProgress(null); setError(''); setMessage(''); setStale(false); setSnapshot(demoSnapshot());
    requestAnimationFrame(() => { if (matchMedia('(max-width: 740px)').matches) document.getElementById('portfolio')?.focus(); });
  }
  function cancel() { running.current?.abort(); setBusy(false); setProgress(null); setMessage('Refresh paused. Load again to resume discovery from the last saved block.'); }
  function resetScan() {
    if (!isAddress(wallet.trim())) { setError('Enter the wallet address whose saved scan you want to clear.'); return; }
    try { localStorage.removeItem(`poolser:v1:1:v4:${wallet.trim().toLowerCase()}`); setMessage('Saved v4 scan cleared for this address. Load the portfolio to start discovery again.'); }
    catch { setError('Browser storage is unavailable. The saved scan could not be cleared.'); }
  }
  const scanPercent = progress?.scanned !== undefined && progress.head !== undefined ? Math.min(100, Math.max(0, Number(progress.scanned - 0x14af301n) / Number(progress.head - 0x14af301n || 1n) * 100)) : null;

  return <div className="app-shell">
    <a className="skip-link" href="#portfolio">Skip to portfolio</a>
    <header className="app-header"><a className="wordmark" href="/" aria-label="Poolser home"><img src="/brand/AppLogo.png" width="46" height="46" alt=""/>Poolser</a><div className="header-tools"><span className="network-badge"><i aria-hidden="true"/> Ethereum</span><label className="theme-select"><span className="sr-only">Appearance</span><select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label></div></header>
    <main className="workspace">
      <aside className="connection"><div className="connection-intro"><p className="eyebrow">Poolser for the web</p><h2>A clear view<br/> of your liquidity.</h2><p>Your Ethereum positions, fees and ranges. A public address is all we need from your wallet.</p></div>
        <form onSubmit={load} noValidate aria-label="Load an Ethereum portfolio"><label htmlFor="wallet">Wallet address</label><input id="wallet" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" disabled={busy} aria-describedby="wallet-note"/><p id="wallet-note" className="field-note">Public address · no wallet connection</p>
          <label htmlFor="api-key">Infura API key</label><input id="api-key" type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" placeholder="Your project API key" disabled={busy || publicRpc} aria-describedby="key-note"/><p id="key-note" className="field-note">Kept in this tab’s memory. Enter it again after a reload.</p>
          <label className="provider-option"><input type="checkbox" checked={publicRpc} onChange={event => setPublicRpc(event.target.checked)} disabled={busy}/> Use public RPC instead</label>{publicRpc && <p className="field-note">{publicProvider.name} receives the chain queries. No API key is sent. History scans may be rate-limited.</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Reading portfolio…' : snapshot && !snapshot.demo && snapshot.wallet.toLowerCase() === wallet.trim().toLowerCase() ? (snapshot.complete ? 'Refresh portfolio' : 'Refresh & resume') : 'Load portfolio'}<span aria-hidden="true">↗</span></button>
          {busy ? <button className="secondary-button" type="button" onClick={cancel}>Pause refresh</button> : <button className="secondary-button" type="button" onClick={demo}>Explore demo</button>}
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div role="status" aria-live="polite" aria-atomic="true" className="load-status">{busy && progress ? <><p>{progress.phase}</p>{scanPercent !== null && <><progress max="100" value={scanPercent} aria-label="v4 discovery progress"/><small>{scanPercent.toFixed(1)}% of history scanned · {progress.candidates ?? 0} candidate NFTs</small></>}</> : message ? <p>{message}</p> : null}</div>
        <div className="connection-footnote"><p><strong>Your keys stay with you.</strong><br/>Poolser reads on-chain data through {publicRpc ? publicProvider.name : 'your Infura project'}. It cannot sign or submit transactions.</p><p>The address and v4 scan progress are saved in this browser. Prices are requested from CoinGecko and DefiLlama.</p><button className="text-button" type="button" disabled={busy} onClick={resetScan}>Clear saved v4 scan</button>{key && <button className="text-button" type="button" disabled={busy} onClick={() => { setKey(''); setMessage('The API key has been removed from the form.'); }}>Forget API key</button>}</div>
      </aside>
      <section className="portfolio" id="portfolio" tabIndex={-1} aria-label="Portfolio overview" aria-busy={busy}>
        {snapshot ? <Portfolio snapshot={snapshot} busy={busy} stale={stale}/> : <section className="welcome"><Crest/><p className="eyebrow">Your liquidity, in view</p><h1>Keep an eye<br/>on what’s yours.</h1><p>See the value, unclaimed fees and price range of your Uniswap v3 and v4 positions, together.</p><div className="welcome-example"><div><span className="welcome-dot"/><span>A read-only view</span></div><p>Add an address and your Infura key to get started, or explore a clearly labelled demo.</p></div><div className="welcome-bottom"><span>v3 + v4</span><span>Ethereum mainnet</span><span>No account</span></div></section>}
      </section>
    </main>
    <footer className="app-footer"><span>Ethereum only · Read-only prototype</span><a href="https://github.com/poolser-app/web" target="_blank" rel="noopener noreferrer">Source & support ↗</a><p>An independent project, unaffiliated with Uniswap Labs or the Uniswap Protocol.</p></footer>
  </div>;
}
