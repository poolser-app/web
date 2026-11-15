# Poolser web implementation reference

Read the [pinned shared brand guide](brand/BRAND.md) first. [manifest.json](brand/manifest.json) records the adopted brand commit and SHA-256 hashes. Original logo/character files live in `public/brand/`; `src/brand/colors.json` is the local token copy. Shared identity changes originate in poolser-app/brand and are adopted explicitly. Builds and page rendering fetch no mutable brand assets or fonts.

## Layout and typography

The prototype is a single Ethereum workspace. A quiet connection column holds the public wallet address, provider choice, tab-only key, read/pause actions and progress. The portfolio column leads with value and unclaimed fees, followed by actual loaded position cards. Before a read, show setup guidance instead of invented zero balances. A separate demo is explicitly labelled fictional, makes no network requests and never persists its sample portfolio.

Use the shared porcelain/deep-pool canvas, white/petrol surfaces, jade earnings, blue current-price marker and rose attention tokens. Apply the vendored JSON tokens for light/dark mode. Avenir Next/Avenir/system fonts carry the wordmark, headings and tabular amounts; system text is used for controls and captions, monospace for the entered address. Financial amounts stay on one line; summary columns stack when their minimum readable width does not fit. An exceptionally long amount can be scrolled inside its own value rather than split or shorten silently.

The original icon leads the header. Soft Crest uses the native wave direction and brighter crest colours; the two eye masks sample the original 1024-pixel image at the native crop coordinates. The crest is decorative and never represents a return metric. Keep it static in this prototype, with no entrance/blink loop. Hover opacity transitions run only when reduced motion is off.

## Financial presentation

Position cards show pair, version, fee tier, known value and unclaimed fees, then a labelled price range. Preserve native quote priority, logarithmic tick geometry, inclusive lower/exclusive upper bound, 3% near-edge threshold, full-range detection, clamped current marker and out-of-range distance/direction. Min/Max and the current quote are textual; status is never communicated by colour alone. Zero unclaimed token amounts read "No unclaimed fees"; positive USD dust reads "<$0.01". Missing fee reads are unavailable, never zero.

ERC-20 metadata failures do not guess 18 decimals. Retain readable token identifiers and suppress derived amounts that need missing decimals. Missing USD prices leave token amounts visible; USD totals use fully priced positions and are explicitly partial while anything is unknown or v4 discovery is incomplete. Keep the last in-memory snapshot visible if a refresh fails, with its block/time and incomplete-refresh label. A completed read label is not a promise of continuous background refresh.

Position Details uses a native HTML disclosure, accessible by keyboard, for token holdings, unclaimed token amounts and ID. Read errors stay visible outside that disclosure. Opening Uniswap is a separate explicit link. This milestone has no history/APR chart, wallet connection, signing or Collect control.

## Interaction and accessibility

Use semantic form labels, visible focus, a skip link, screen-reader readable metrics and textual notices. On small screens the connection form appears first; showing a new portfolio or choosing demo focuses the portfolio region so the result is discoverable. Controls remain usable without hover. Appearance offers system/light/dark and follows OS changes in system mode. Theme choice is not persisted yet.

Wallet address and resumable v4 discovery live in browser storage. The Infura key remains in the form's memory and is sent only to the Infura RPC endpoint. The public-provider alternative explains the provider and key-free behaviour. Pause aborts pending requests and retry waits. A refresh is bounded to 120 completed log windows; the resume action and notices explain partial progress. Storage failures, archive restrictions, lagging nodes and provider throttling are explicit. Clearing scan data is a separate action for the entered wallet.

Reference screenshots in `screenshots/` use only the built-in fictional demo and blank credential inputs.
