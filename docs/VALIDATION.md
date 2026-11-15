# Prototype validation

Checked on 2026-11-15. Evidence below uses public chain samples and fictional demo screenshots. No personal Infura key, private wallet configuration, real portfolio screenshot or captured RPC payload is committed.

## Deterministic checks

- `npm test`: 31 passing tests. Native parity cases cover uint256 subtraction/wraparound, high fee-growth accumulators and Q128 flooring, signed v4 packed ticks, pool IDs, holdings with token decimal scaling, quote orientation, lower-inclusive/upper-exclusive range boundaries, near-edge/full-range states, zero/dust and unavailable prices/reads.
- Encoded RPC/Multicall fixtures exercise complete v3 + v4 loading at a fixed block, owner-origin v3 `collect` simulation, partial snapshots, failed fee/metadata/ownership reads, price fallback/cache, range shrinking without gaps, 120-window work bounds, saved checkpoints/reorg overlap, lagging nodes, corrupt/quota-limited storage, retries, cancellation and sanitized errors.
- Browser-global fetch receiver regression covers both RPC and price requests. The in-app WebKit browser exposed this issue during real reads; default transports now bind the global fetch function explicitly.
- `npm run check:brand`: all four vendored assets/tokens/guide match SHA-256 hashes at brand commit `dc734b0513d7a642bf2bc37f391115e942daa8c7`.
- `npm run build`: strict TypeScript check and production Vite build pass. No backend or wallet/signing dependencies are needed.

## Public live reads

`npm run test:live` resolves public sample owners from chain instead of keeping wallet addresses in the repository. It reads funded v3 positions for one reference owner and separately discovers/loads a small v4 portfolio. Availability and ownership can change; deterministic checks do not depend on these services.

Observed sanitized result:

```json
{"status":"passed","block":"26420532","v3ReferencePositions":3,"v4Positions":1,"complete":true,"positionsWithUSD":1,"priceWarnings":1}
```

The v3 reference had three funded positions with readable pool state and simulated fees. The v4 sample completed ownership discovery against the live NFT balance and returned pool state, exact fee-growth-derived fees and a USD value. The combined one-wallet v3 + v4 path is additionally covered by the encoded fixture test.

## Browser checks

The local Vite app is tested in the in-app WebKit browser. Following native UI review, the interface uses the same fees-first summary, compact toolbar, native labels, token-pair identity and blue current-price badge. Original shared artwork/tokens remain pinned. Invented slogans and the persistent setup sidebar have been removed.

The UI revision was checked at desktop, 390px and 320px widths in light/dark mode. Tests cover attention filtering, sort selection, keyboard activation of Details/explanations, Escape dismissal and Settings cancellation restoring edited fields. Wallet/Infura have one visible field heading each, with hidden accessible labels. Price badges remain inside their tracks; money values do not split across lines. No fee history, APR or water level is fabricated.

A real public dRPC browser read completed at block **26420593** with **one funded v4 position**, readable holdings, nonzero fees, USD value and labelled range. CoinGecko failed and DefiLlama supplied the fallback price; the notice remained visible. Pausing produced an explicit partial state; reload remembered the wallet and resumed saved discovery to completion. A fictional key entered without submitting a request disappeared after reload; no real credentials were used. The sample scan checkpoint was cleared after QA. These transport/math checks remain unchanged by the UI revision. After moving settings into a dialog, Save and toolbar Refresh were also checked against public RPC for an empty nonzero test address: both returned known-zero totals and No active positions found. A reverting zero-address ownership read remained partial/unavailable rather than becoming an empty portfolio.

Screenshots contain fictional demo data and blank address/credential inputs:

- [Light desktop](screenshots/demo-light.jpg)
- [Dark desktop](screenshots/demo-dark.jpg)
- [Mobile](screenshots/demo-mobile.jpg)
- [Settings](screenshots/settings.jpg)
- [Position details](screenshots/position-details.jpg)

## Provider behaviour and limits

- dRPC's public Ethereum endpoint responded to localhost CORS preflight with an allowed origin and to a JSON-RPC POST with `Access-Control-Allow-Origin: *`. Its free provider responses can reject oversized log ranges with HTTP 400 / JSON-RPC code 35. Observed effective upstream windows shrank as low as 78 blocks. The app learns the smaller window, saves contiguous progress and bounds each refresh to 120 successful windows. A large or recently funded wallet can require many resumes; a suitable Infura project is preferable for that workload.
- PublicNode answered ordinary Ethereum reads but rejected historical logs with HTTP 403 and an archive/personal-token requirement. This is classified as access unavailable rather than an empty portfolio. It is not the selected UI public provider.
- CoinGecko was restricted/unavailable in the live environment. DefiLlama supplied the sample prices. These services have independent availability, CORS, rate and coverage limits; missing prices leave USD unavailable and partial totals explicit.
- Browser contract metadata comes from ERC-20 reads through the selected RPC, avoiding a separate metadata service or token-icon dependency. A failed decimals read never guesses 18.
- Personal Infura credentials and a project's allowed-origin/archive configuration were not supplied for this run. The Infura input/path, memory-only key handling and redacted failure behaviour are implemented; a live credentialed Infura check remains a user-project configuration check before release.

This is a local read-only Ethereum prototype. Multichain support, saved portfolio history, transaction signing/Collect, production hosting, response security headers and a release are separate roadmap milestones.

## First native-parity task (#8)

Native baseline: `7c1e0ab22bc952626d7dd18de14645c07ecacad6`, especially TokenPairAvatar, TokenIconStore, NetworkIconStore, PositionPresentation and their tests. Added cached original artwork, native glyph colours, accurate dust/unpriced labels, native price precision, explicit clamped marker accessibility and measured/wrapping price labels. Token values below the native six-decimal display precision keep an explicit <0.000001 guard. No financial loader, account or transaction behaviour changes.

`npm test` now covers 31 deterministic cases, including artwork identity/deduplication/positive and negative caches/allowed destinations, pinned demo image hashes, native labels/precision, clamped range and measured label centres. Build, pinned shared-brand hashes and documentation links are checked separately.

WebKit loaded all three real public artwork sources into decoded images through the credential-free fetch/cache path. The development-only `/tests/presentation.html` fixture includes oversized quote symbols, dust, failed reads and full range. At 320px with 200% financial text, the document width matched the viewport and both price badges stayed horizontally and vertically within their tracks. The same states were inspected in light/dark mode. Normal demo prices retained one-line labels at 320px. This fixture is not the application route and is excluded from the production bundle.

- [Enlarged text](screenshots/presentation-large-text.jpg)
- [Dark edge cases](screenshots/presentation-edge-dark.jpg)

Remaining networks, saved wallets/list controls, full Details/pool stats, history/returns, motion, runtime controls and Collect are tracked explicitly in the [parity checklist](NATIVE_PARITY.md).
