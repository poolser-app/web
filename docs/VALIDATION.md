# Prototype validation

Checked on 2026-11-15 and extended on 2026-11-16. Evidence below uses public chain samples and fictional demo screenshots. No personal Infura key, private wallet configuration, real portfolio screenshot or captured RPC payload is committed.

## Deterministic checks

- `npm test`: 44 passing tests (the previous 31 plus 13 network cases). Native parity cases cover uint256 subtraction/wraparound, high fee-growth accumulators and Q128 flooring, signed v4 packed ticks, pool IDs, holdings with token decimal scaling, quote orientation, lower-inclusive/upper-exclusive range boundaries, near-edge/full-range states, zero/dust and unavailable prices/reads.
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

This is a local read-only multichain prototype. Saved portfolio history, transaction signing/Collect, production hosting, response security headers and a release are separate roadmap milestones.

## First native-parity task (#8)

Native baseline: `7c1e0ab22bc952626d7dd18de14645c07ecacad6`, especially TokenPairAvatar, TokenIconStore, NetworkIconStore, PositionPresentation and their tests. Added cached original artwork, native glyph colours, accurate dust/unpriced labels, native price precision, explicit clamped marker accessibility and measured/wrapping price labels. Token values below the native six-decimal display precision keep an explicit <0.000001 guard. No financial loader, account or transaction behaviour changes.

`npm test` now covers 31 deterministic cases, including artwork identity/deduplication/positive and negative caches/allowed destinations, pinned demo image hashes, native labels/precision, clamped range and measured label centres. Build, pinned shared-brand hashes and documentation links are checked separately.

WebKit loaded all three real public artwork sources into decoded images through the credential-free fetch/cache path. The development-only `/tests/presentation.html` fixture includes oversized quote symbols, dust, failed reads and full range. At 320px with 200% financial text, the document width matched the viewport and both price badges stayed horizontally and vertically within their tracks. The same states were inspected in light/dark mode. Normal demo prices retained one-line labels at 320px. This fixture is not the application route and is excluded from the production bundle.

- [Enlarged text](screenshots/presentation-large-text.jpg)
- [Dark edge cases](screenshots/presentation-edge-dark.jpg)

Remaining saved wallets/list controls, full Details/pool stats, history/returns, motion, runtime controls and Collect are tracked explicitly in the [parity checklist](NATIVE_PARITY.md).


## Supported networks (#2)

Reference: native `215682391bcacc9ccb55f2e051bddd608512b42f`, including ChainConfig, both position loaders, price/native-symbol mappings, artwork and tests. See the maintained [capability/provider matrix](NETWORKS.md).

- 44 deterministic tests pass, preserving all prior 31. New cases exercise every supported chain at its own fixed block, v3-only exclusions, unsupported deployments, wrong-chain rejection before ownership/discovery, enabled-network validation/storage failure, global serial credit spacing/retries/cancellation, identical NFT IDs across wallet/chain/version, chain-isolated pause/resume cursors, stale snapshot retention/recovery, failed ownership, zero versus unknown, native-symbol/wrapper/platform mapping and ZKsync Multicall splitting/single-read fallback.
- `npm run build` passes TypeScript and production bundling. `npm run check:brand` verifies the unchanged locally pinned shared identity. The network fixture remains development-only in `/tests/presentation.html#networks` and is excluded from the production build.
- The existing `npm run test:live` public Ethereum integration check also passed after the network changes, with three funded v3 reference positions and one fully discovered v4 position:

```json
{"status":"passed","block":"26425756","v3ReferencePositions":3,"v4Positions":1,"complete":true,"positionsWithUSD":1,"priceWarnings":1}
```

- `npm run test:networks` uses configured public RPCs with a fictional nonzero address, no key and no saved wallet configuration. The initial full-native run completed fixed-block ownership reads with known-zero results on 12 chains; Blast was unavailable. The command intentionally exited nonzero for incomplete provider coverage. No wallet, credential, raw RPC response or portfolio capture is stored by this check.

Sanitized observed blocks from that run:

| Network | Block | Status |
| --- | ---: | --- |
| Ethereum | 26425711 | ready |
| Base | 58095734 | ready |
| Arbitrum | 524668404 | ready |
| Optimism | 159605372 | ready |
| Polygon | 97402703 | ready |
| Blast | unavailable | unavailable |
| Avalanche | 100453364 | ready |
| Celo | 82908765 | ready |
| ZKsync | 72967046 | ready |
| BSC | 133877446 | ready |
| MegaETH | 32012513 | ready |
| Monad | 122666015 | ready |
| Unichain | 64061165 | ready |

Blast dRPC answered `eth_chainId` (81457) but rejected `eth_blockNumber`. The official/public alternatives checked in this environment were unavailable or denied access. BSC failed transiently in the first run and passed on repeat; this is why capability and provider availability remain separate. These live checks validate connections/deployed ownership reads, not funded positions and historical-log coverage on every chain; encoded funded-position/discovery fixtures cover the complete matrix. No live Infura project was used.

Browser QA used native browser controls against the local Vite server in Dia and Chrome. Base/ZKsync completed independently at blocks 58094922/72967008. A Chrome read of Ethereum, Base, Blast and BSC preserved an explicit Blast unavailable notice and partial/unknown totals while the other chains completed. An empty network selection was rejected; unsupported deployments were disabled and labelled. Reload retained enabled networks and the fictional wallet, cleared a fictional unsubmitted key, and did not retain portfolio data. Settings Cancel/Escape restored network edits. The fictional mixed ready/stale/unavailable fixture showed the original chain block/time, partial totals and stale card captions/accessibility names. Light/dark and a 375px iPhone SE viewport with 200% financial text were inspected; stale captions wrapped without losing their labels or amounts. A broader browser/screen-reader/contrast matrix remains part of release acceptance (#6); no such full-matrix claim is made here.


### Blast scope adjustment

Blast is excluded from browser monitoring by product scope. Its native deployment configuration remains reference-only; it is absent from Settings and the live matrix, and aggregate requests reject a selection containing it before any RPC reads. Saved mixed selections drop Blast with a notice and retain valid remaining networks; a Blast-only or corrupt selection falls back visibly to Ethereum for review. The regression fixture covers migration, validation and zero requests for an excluded selection. The maintained monitoring matrix now contains 12 networks; the earlier 13-network failure evidence above is historical.

After the exclusion, `npm run test:networks` passed (exit 0) on all 12 monitored networks with the fictional address: Ethereum at block 26425970, Base 58111297, Arbitrum 524678922, Optimism 159606929, Polygon 97404778, Avalanche 100456674, Celo 82911876, ZKsync 72967872, BSC 133884371, MegaETH 32015625, Monad 122676259 and Unichain 64064277. The sanitized aggregate result was:

```json
{"complete":true,"ready":12,"unavailable":0,"walletStored":false,"credentialsUsed":false}
```

`npm test` passes all 44 cases; build and the pinned brand check pass after this scope adjustment.
