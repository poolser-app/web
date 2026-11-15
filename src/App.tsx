import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
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
const historyHelp = 'Claimed fee history is not available. Unknown fees are not treated as zero.';
const aprHelp = 'Realized APR is unavailable until opening dates and claimed fees are available. It is not a forecast.';

function Icon({ name }: { name: 'refresh' | 'settings' | 'info' | 'chevron' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'refresh' ? <><path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5"/></> : name === 'settings' ? <><path d="M3 6h7m4 0h7M3 12h2m4 0h12M3 18h11m4 0h3"/><circle cx="12" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></> : name === 'info' ? <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></> : <path d="m6 9 6 6 6-6"/>}</svg>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = title === 'Settings' ? 'settings-title' : 'details-title';
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="dialog-header"><h2 id={titleId}>{title}</h2><button className="text-button" onClick={onClose}>{title === 'Settings' ? 'Cancel' : 'Done'}</button></header>{children}
  </dialog>;
}

function Crest() {
  const edge = 'M1000 0H750C570 0 540 55.18 390 50.84C140 32.86 110 60.76 0 59.52';
  return <div className="crest" aria-hidden="true">
    <svg viewBox="0 0 1000 62" preserveAspectRatio="none"><defs><linearGradient id="crest-gradient"><stop stopColor="#2E82F0"/><stop offset=".34" stopColor="#30B8A6"/><stop offset=".7" stopColor="#59CC6B"/></linearGradient><linearGradient id="crest-rim" x2="0" y2="1"><stop stopColor="white" stopOpacity=".3"/><stop offset=".5" stopColor="white" stopOpacity="0"/></linearGradient><clipPath id="crest-clip"><path d={`${edge}V0Z`}/></clipPath></defs><g clipPath="url(#crest-clip)"><path fill="url(#crest-gradient)" d={`${edge}V0Z`}/><path fill="url(#crest-rim)" d={`${edge}V0Z`}/></g><path d={edge} fill="none" stroke="var(--card)" strokeOpacity=".4" strokeWidth=".6"/></svg>
    <span className="eyes"><i/><i/></span>
  </div>;
}

function TokenIcon({ symbol, address }: { symbol: string; address: string }) {
  const eth = address.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' || address === '0x0000000000000000000000000000000000000000';
  const usdc = address.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  return <span className={`token-icon ${eth ? 'eth' : usdc ? 'usdc' : 'generic'}`} aria-hidden="true">{eth ? <svg viewBox="0 0 32 32"><path fill="#8C919B" d="m16 2-9 14 9 5 9-5z"/><path fill="#343A43" d="M16 2v19l9-5z"/><path fill="#8C919B" d="m7 18 9 13 9-13-9 5z"/><path fill="#343A43" d="M16 23v8l9-13z"/></svg> : usdc ? <svg viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M10 6a12 12 0 0 0 0 20M22 6a12 12 0 0 1 0 20M20 11c-1-3-8-3-8 1 0 5 8 2 8 7 0 4-7 4-8 1M16 7v3m0 12v3"/></svg> : symbol.slice(0, 2).toUpperCase()}</span>;
}

function HelpMetric({ label, explanation }: { label: string; explanation: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="metric" aria-label={`${label}: unavailable. Show explanation`} onClick={() => setOpen(true)}><span>{label} <Icon name="info"/></span><strong>—</strong></button>{open && <Modal title={label} onClose={() => setOpen(false)}><p className="explanation">{explanation}</p></Modal>}</>;
}

function PositionCard({ position: p, demo }: { position: Position; demo?: boolean }) {
  const r = range(p);
  const [details, setDetails] = useState(false);
  const noFees = p.fees0 === 0 && p.fees1 === 0;
  const feeLabel = noFees ? 'No unclaimed fees' : p.feesUSD !== null ? `${p.feesUSD > 0 ? '+' : ''}${usd(p.feesUSD)} fees` : p.fees0 !== null && p.fees1 !== null ? `${tokenAmount(p.fees0)} ${p.token0.symbol} + ${tokenAmount(p.fees1)} ${p.token1.symbol} fees` : 'Fees unavailable';
  const knownFees = p.fees0 !== null && p.fees1 !== null;
  const fee = p.fee & 0x800000 ? 'Dynamic fee' : `${p.fee / 10000}%`;
  const hasPair = p.token0.decimals !== null || p.token1.decimals !== null;
  const base = r.base === p.token0.symbol ? p.token0 : p.token1;
  const quote = base === p.token0 ? p.token1 : p.token0;
  const priceBadge = useRef<HTMLSpanElement>(null);
  const [badgeWidth, setBadgeWidth] = useState(0);
  useEffect(() => {
    const node = priceBadge.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setBadgeWidth(node.getBoundingClientRect().width));
    observer.observe(node); return () => observer.disconnect();
  }, [r.current]);
  return <article className={`position ${r.status}`} aria-label={`${hasPair ? `${r.base}/${r.quote}` : 'Unread position'}, Uniswap v${p.version}, ${r.title}`}>
    <header className="position-header">
      <div className="position-identity"><div className="token-pair"><TokenIcon symbol={base.symbol} address={base.address}/><TokenIcon symbol={quote.symbol} address={quote.address}/><span className="chain-icon" aria-hidden="true">◆</span></div><div><h3 className="pair">{hasPair ? `${r.base}/${r.quote}` : 'Position unavailable'}</h3><p className="caption">Ethereum · v{p.version} · {fee}</p></div></div>
      <div className="position-value"><strong>{usd(p.valueUSD)}</strong><span className={noFees || !knownFees ? 'quiet' : 'fee-amount'}>{feeLabel}</span></div>
    </header>
    <div className="range-heading"><span>Price range · {r.quote}</span><span className="status"><b aria-hidden="true">●</b> {r.title}</span></div>
    <div className="price-label-track" aria-label={`Current price ${formatPrice(r.current)} ${r.quote} per ${r.base}`}>
      {r.marker !== null && r.current !== null ? <span className="price-badge" ref={priceBadge} style={{ left: `clamp(${badgeWidth / 2}px, ${r.marker * 100}%, calc(100% - ${badgeWidth / 2}px))` }}>{formatPrice(r.current)} {r.quote}</span> : <span className="quiet">Current price unavailable</span>}
    </div>
    <div className="range-track" aria-hidden="true">
      <span className="range-band" style={{ left: `${r.bandStart * 100}%`, width: `${(r.bandEnd - r.bandStart) * 100}%` }}/>
      <span className="range-tick" style={{ left: `${r.bandStart * 100}%` }}/><span className="range-tick" style={{ left: `calc(${r.bandEnd * 100}% - 1px)` }}/>
      {r.marker !== null && <span className="range-marker" style={{ left: `clamp(0px, calc(${r.marker * 100}% - 1.5px), calc(100% - 3px))` }}/>}</div>
    <div className="range-bounds"><span>Min <strong>{formatPrice(r.min)}</strong></span><span>Max <strong>{formatPrice(r.max)}</strong></span></div>
    {r.distance && <p className="distance">{r.distance.endsWith('below') ? '↙' : '↗'} {r.distance} range</p>}
    {!!p.errors.length && <ul className="read-errors">{p.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <footer className="position-footer"><HelpMetric label="Claimed" explanation={historyHelp}/><HelpMetric label="APR since open" explanation={aprHelp}/><button className="details-button" aria-label={`Details for ${r.base}/${r.quote}, v${p.version}`} title="Details" onClick={() => setDetails(true)}><Icon name="info"/></button></footer>
    {details && <Modal title="Position details" onClose={() => setDetails(false)}><div className="balance-tiles">{[p.token0, p.token1].map((token, index) => <div key={index}><span>{token.symbol} held</span><strong>{tokenAmount(index === 0 ? p.amount0 : p.amount1)}</strong></div>)}</div><dl><div><dt>Position ID</dt><dd>{p.id}</dd></div><div><dt>{p.token0.symbol} unclaimed</dt><dd>{tokenAmount(p.fees0)}</dd></div><div><dt>{p.token1.symbol} unclaimed</dt><dd>{tokenAmount(p.fees1)}</dd></div></dl>
      {!demo && !p.id.startsWith('unread-') && <a className="primary-button uniswap-link" href={p.version === 4 ? `https://app.uniswap.org/positions/v4/mainnet/${p.id}` : `https://app.uniswap.org/pools/${p.id}?chain=mainnet`} target="_blank" rel="noopener noreferrer">Open in Uniswap ↗</a>}</Modal>}
  </article>;
}

function Portfolio({ snapshot }: { snapshot: Snapshot }) {
  const total = totals(snapshot, 'valueUSD'), fees = totals(snapshot, 'feesUSD');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sort, setSort] = useState<'valueUSD' | 'feesUSD'>('valueUSD');
  const attention = snapshot.positions.filter(p => ['outOfRange', 'nearEdge', 'unknown'].includes(range(p).status));
  const positions = [...(attentionOnly ? attention : snapshot.positions)].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  return <>
    <h1 className="sr-only">Portfolio</h1>
    <section className="portfolio-summary" aria-label="Portfolio summary"><Crest/>
      <div className="summary-metrics"><div className="summary-fees"><p>{fees.partial ? 'Unclaimed fees · partial' : 'Unclaimed fees'}</p><strong>{usd(fees.value)}</strong></div><div className="summary-value"><p>{total.partial ? 'Total value · partial' : 'Total value'}</p><strong>{usd(total.value)}</strong></div></div>
      {(fees.partial || total.partial) && <p className="partial-note">Some positions or amounts are unavailable. Totals include only known values.</p>}
      <div className="summary-stats"><HelpMetric label="Claimed" explanation={historyHelp}/><HelpMetric label="Pool level" explanation="Pool level includes claimed and unclaimed fees relative to position value. It is unavailable until claimed fee history is available."/><HelpMetric label="APR" explanation={aprHelp}/></div>
    </section>
    {!!snapshot.warnings.length && <div className="notices" aria-label="Read notices">{snapshot.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
    <h2 className="sr-only">Positions</h2>
    <nav className="position-controls" aria-label="Position filters"><div><button className={`chip ${!attentionOnly ? 'selected' : ''}`} aria-pressed={!attentionOnly} onClick={() => setAttentionOnly(false)}>All {snapshot.positions.length}</button><button className={`chip attention ${attentionOnly ? 'selected' : ''}`} aria-pressed={attentionOnly} onClick={() => setAttentionOnly(true)}>Needs attention {attention.length}</button></div><span className="select-control"><select aria-label="Sort positions" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="valueUSD">Sort: Value</option><option value="feesUSD">Sort: Fees</option></select><Icon name="chevron"/></span></nav>
    {positions.length ? <div className="positions">{positions.map(p => <PositionCard key={`${p.version}-${p.id}`} position={p} demo={snapshot.demo}/>)}</div>
      : <section className="empty-positions"><h2>{attentionOnly ? 'No positions match the filters' : snapshot.complete ? 'No active positions found' : 'Portfolio incomplete'}</h2>{!snapshot.complete && <p>Refresh to resume discovery. Unknown amounts are not treated as zero.</p>}</section>}
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBefore = useRef({ wallet, key, publicRpc });
  const running = useRef<AbortController | null>(null);

  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => applyTheme(theme);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [theme]);
  useEffect(() => () => running.current?.abort(), []);

  function focusPortfolio() { requestAnimationFrame(() => document.getElementById('portfolio')?.focus()); }
  function openSettings() { settingsBefore.current = { wallet, key, publicRpc }; setSettingsOpen(true); }
  function closeSettings() { setWallet(settingsBefore.current.wallet); setKey(settingsBefore.current.key); setPublicRpc(settingsBefore.current.publicRpc); setError(''); setSettingsOpen(false); }

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setError(''); setMessage('');
    const address = wallet.trim();
    if (!isAddress(address)) { setError('Enter a valid Ethereum address starting with 0x. ENS names are not supported yet.'); return; }
    if (!publicRpc && !/^[a-zA-Z0-9_-]{16,128}$/.test(key.trim())) { setError('Enter your Infura project API key, without a URL or API secret.'); if (snapshot) openSettings(); return; }
    setSettingsOpen(false);
    running.current?.abort();
    const controller = new AbortController(); running.current = controller;
    if (snapshot?.wallet.toLowerCase() !== address.toLowerCase() || snapshot.demo) setSnapshot(null);
    setBusy(true); setStale(!!snapshot && !snapshot.demo); setProgress(null);
    const storage = browserStorage();
    try { storage?.setItem('poolser:last-wallet', address); } catch { setMessage('This browser could not save the wallet address.'); }
    focusPortfolio();
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
    running.current?.abort(); setBusy(false); setProgress(null); setError(''); setMessage(''); setStale(false); setSnapshot(demoSnapshot()); setSettingsOpen(false); focusPortfolio();
  }
  function cancel() { running.current?.abort(); setBusy(false); setProgress(null); setMessage('Refresh paused. Refresh again to resume discovery from the last saved block.'); }
  function resetScan() {
    if (!isAddress(wallet.trim())) { setError('Enter the wallet address whose saved scan you want to clear.'); return; }
    try { localStorage.removeItem(`poolser:v1:1:v4:${wallet.trim().toLowerCase()}`); setMessage('Saved v4 scan cleared for this address. Refresh to start discovery again.'); }
    catch { setError('Browser storage is unavailable. The saved scan could not be cleared.'); }
  }
  const scanPercent = progress?.scanned !== undefined && progress.head !== undefined ? Math.min(100, Math.max(0, Number(progress.scanned - 0x14af301n) / Number(progress.head - 0x14af301n || 1n) * 100)) : null;
  const connection = <form onSubmit={load} noValidate aria-label="Portfolio settings">
    <fieldset><legend>Wallet</legend><label className="sr-only" htmlFor="wallet">Wallet address</label><input id="wallet" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" disabled={busy} aria-describedby="wallet-note"/><p id="wallet-note" className="field-note">Public address · no wallet connection</p></fieldset>
    <fieldset><legend>Infura</legend><label className="sr-only" htmlFor="api-key">API key</label><input id="api-key" type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" placeholder="API key" disabled={busy || publicRpc} aria-describedby="key-note"/><p id="key-note" className="field-note">Your key stays in this tab’s memory. Positions are read directly from chain RPC. Enter the key again after a reload.</p>
      <label className="provider-option"><input type="checkbox" checked={publicRpc} onChange={event => setPublicRpc(event.target.checked)} disabled={busy}/> Use public RPC instead</label>{publicRpc && <p className="field-note">{publicProvider.name} receives the chain queries. No API key is sent. History scans may be rate-limited.</p>}</fieldset>
    <fieldset><legend>Networks</legend><div className="network-row"><span>Ethereum</span><span className="network-check" aria-label="Enabled">✓</span></div></fieldset>
    <label className="appearance-row">Appearance<span className="select-control"><select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><Icon name="chevron"/></span></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="settings-actions"><button className="primary-button" type="submit" disabled={busy}>Save</button><button className="secondary-button" type="button" onClick={demo} disabled={busy}>Use demo data</button></div>
    <details className="data-settings"><summary>Data & privacy</summary><p>The wallet address and scan progress are saved in this browser. Prices come from CoinGecko and DefiLlama. <a href="https://github.com/poolser-app/web/blob/codex/web-prototype/docs/PRIVACY.md" target="_blank" rel="noopener noreferrer">Data flow ↗</a></p><button className="text-button" type="button" disabled={busy} onClick={resetScan}>Clear saved v4 scan</button>{key && <button className="text-button" type="button" disabled={busy} onClick={() => { setKey(''); settingsBefore.current.key = ''; setMessage('The API key has been removed.'); }}>Forget API key</button>}{message && <p role="status">{message}</p>}</details>
  </form>;

  return <div className="app-shell">
    <a className="skip-link" href="#portfolio">Skip to portfolio</a>
    <header className="app-header"><a className="wordmark" href="/" aria-label="Poolser home"><img src="/brand/AppLogo.png" width="28" height="28" alt=""/>Poolser</a><span className="wallet-badge" title={snapshot && !snapshot.demo ? snapshot.wallet : undefined}>{snapshot?.demo ? 'Demo' : snapshot ? short(snapshot.wallet) : busy && isAddress(wallet.trim()) ? short(wallet.trim()) : 'no wallet'}</span><div className="header-tools"><button className="icon-button" aria-label="Refresh" title="Refresh" disabled={busy || !snapshot} onClick={() => snapshot?.demo ? demo() : void load()}><Icon name="refresh"/></button><button className="icon-button" aria-label="Settings" title="Settings" disabled={busy || (!snapshot && !error)} onClick={openSettings}><Icon name="settings"/></button></div></header>
    <main id="portfolio" tabIndex={-1} aria-label="Portfolio overview" aria-busy={busy}>
      {!snapshot && !busy ? <section className="setup-card"><h1>Settings</h1>{connection}</section> : <>
        {snapshot && <Portfolio key={snapshot.wallet} snapshot={snapshot}/>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div role="status" aria-live="polite" aria-atomic="true" className="load-status">{busy ? <><div className="progress-heading"><p>{progress?.phase ?? 'Fetching positions…'}</p><button className="text-button" onClick={cancel}>Pause refresh</button></div>{scanPercent !== null && <><progress max="100" value={scanPercent} aria-label="v4 discovery progress"/><small>{scanPercent.toFixed(1)}% of history scanned · {progress?.candidates ?? 0} candidate NFTs</small></>}</> : message ? <p>{message}</p> : null}</div>
      </>}
    </main>
    <footer className="app-footer"><span className={stale || snapshot && !snapshot.complete ? 'stale' : ''}><i aria-hidden="true"/>{busy ? 'Updating…' : snapshot?.demo ? 'Fictional data · not connected' : snapshot ? `${stale ? 'Last successful update' : 'Updated'} ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${!snapshot.complete ? ' · incomplete' : ''}` : 'Not updated yet'}</span><a href="https://github.com/poolser-app/web" target="_blank" rel="noopener noreferrer">Source ↗</a></footer>
    <p className="prototype-note">Ethereum · Read-only prototype<span>Independent of Uniswap Labs and the Uniswap Protocol.</span></p>
    {settingsOpen && (snapshot || busy) && <Modal title="Settings" onClose={closeSettings}>{connection}</Modal>}
  </div>;
}
