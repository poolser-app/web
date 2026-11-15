# Poolser web

A read-only browser prototype for Uniswap v3 and v4 positions on **Ethereum mainnet**. Load one public wallet to see portfolio value, unclaimed fees, token amounts and labelled price ranges. No wallet connection or account is required. The optional demo uses fictional positions and makes no network requests.

## Run locally

Requires Node.js 22.18 or later and npm.

```bash
npm ci
npm run dev
```

Open the Local URL printed by Vite. Enter a public Ethereum address and your own Infura project API key, then select **Save**. Enable Ethereum mainnet and allow the local browser origin in the Infura project if it restricts origins. Enter only the project key, not a full RPC URL or API secret. The key is kept in memory and must be entered again after reload.

For a key-free read, explicitly select **Use public RPC instead**. This uses dRPC and can have stricter history/rate limits. **Use demo data** lets you inspect the interface without either provider.

The portfolio follows the native app: unclaimed fees first, Total value, native range cards and a compact Refresh/Settings toolbar. Open **Settings** to change the wallet/provider; the setup form does not stay beside the portfolio.

The app uses React, TypeScript and Vite; viem provides ABI encoding/decoding and Keccak. It has no backend or indexer. Contract addresses and the v4 deployment block come from the native Ethereum configuration, checked against the official Uniswap deployments. The repository is a prototype; production hosting is a separate roadmap milestone.

## Loading, pausing and unavailable data

- All contract reads in a refresh use one block. Multicall batches are bounded, with fallback splitting for provider gas/size caps; v3 fee collection is simulated directly with the owner's address through `eth_call`.
- RPC requests share conservative serial credit pacing, transient retries, request timeouts and cancellation. Pause cancels the request/retry wait. The application has no transaction-sending code.
- v4 does not support ERC-721 enumeration. Discover incoming Transfer events in contiguous windows, verify candidates with `ownerOf`, and save each completed window. Smaller provider limits shrink the window without advancing across a failed request. A 24-block overlap is replayed on resume. Matching the live NFT balance at the same block proves when all current owners are accounted for, allowing discovery to finish early.
- Each refresh scans at most 120 successful windows. **Refresh** continues from saved progress, including after a reload and re-entering the key. Restricted public providers can need many refreshes; use an Infura project with suitable historical-log access for larger portfolios. A lagging node never rewinds a saved cursor. **Clear saved v4 scan** restarts discovery for the entered wallet.
- A failed read, incomplete discovery or missing token metadata is not a zero balance. Positive tokens missing prices leave USD unavailable; totals explicitly identify partial coverage. CoinGecko has a DefiLlama fallback. Known zero fees remain zero, and dust is not rounded into a false empty balance.

## Checks

```bash
npm test
npm run check:brand
npm run build
npm run preview
npm run test:live
```

The offline tests use encoded JSON-RPC/ABI fixtures and native parity cases. The live check reads public on-chain samples at runtime, exercises v3 reads and complete v4 discovery, and prints only block/count/status evidence. It stores no wallet address, key or portfolio capture. `POOLSER_RPC_URL` can select another RPC for the live check; supply credentials through your process environment, never source files or command arguments. A sample's availability/ownership or a public provider's limits can change, so the live check is separate from deterministic tests. See [validation](docs/VALIDATION.md) for actual checks and observed limits.

Shared identity is pinned in [docs/brand/manifest.json](docs/brand/manifest.json). Web interface adaptations are documented in [docs/BRAND.md](docs/BRAND.md), with [prototype data flow](docs/PRIVACY.md) separately from the native privacy policy. Keep adopted files local; update hashes and the reviewed brand revision together. No build fetches brand resources or fonts. Live token/network icons use the same public artwork sources as native with an in-memory cache and stable fallbacks; demo icons are pinned locally. For manual presentation edge cases, run the dev server and open `/tests/presentation.html` (fictional data and public artwork only; excluded from the production build). See the [native parity checklist](docs/NATIVE_PARITY.md) for remaining work.

## Next milestones

Additional networks, saved wallets/All Wallets, fee history/realized returns, wallet collection and production deployment have separate [roadmap issues](https://github.com/poolser-app/.github/issues/1). Native menu-bar integration and widgets remain native features.

- [native](https://github.com/poolser-app/native): implementation reference and financial fixtures.
- [brand](https://github.com/poolser-app/brand): shared guide and original artwork.
- [website](https://github.com/poolser-app/website): product presentation, downloads, support and privacy pages.

Poolser is an independent project with no affiliation, association or connection to Uniswap Labs or the Uniswap Protocol. “Uniswap” is a trademark of Uniswap Labs. MIT; see [LICENSE](LICENSE).
