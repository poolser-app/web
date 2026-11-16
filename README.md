# Poolser web

A read-only browser prototype for Uniswap positions on **12 native-supported networks**. v3 + v4: Ethereum, Base, Arbitrum, Optimism, Polygon and Unichain. v3 only: Avalanche, Celo, ZKsync, BSC, MegaETH and Monad. Blast is excluded from browser monitoring. Palm, Linea and Mantle have no supported deployment and cannot be enabled. Load one public wallet to see portfolio value, unclaimed fees, token amounts and labelled price ranges. No wallet connection or account is required. The optional demo uses fictional positions and makes no network requests.

## Run locally

Requires Node.js 22.18 or later and npm.

```bash
npm ci
npm run dev
```

Open the Local URL printed by Vite. Enter a public EVM address, choose at least one network and select a provider, then **Save**. With Infura, enable each selected network in the project and allow the local browser origin if it restricts origins. Access to an individual network depends on the provider/project. For Infura, enter only the project key, not a full RPC URL or API secret. The key is kept in memory and must be entered again after reload.

For a key-free read, explicitly select **Use public RPC instead**. Each network lists its public RPC host. Most use dRPC; MegaETH and Monad use their public endpoints. Public services can have stricter history/rate limits or become unavailable; no key is required for development. **Use demo data** lets you inspect the interface without either provider.

The portfolio follows the native app: unclaimed fees first, Total value, native range cards and a compact Refresh/Settings toolbar. Open **Settings** to change the wallet/provider; the setup form does not stay beside the portfolio.

The app uses React, TypeScript and Vite; viem provides ABI encoding/decoding and Keccak. It has no backend or indexer. Contract addresses, deploy blocks, supported versions, native assets, price IDs, artwork and Uniswap slugs follow the pinned [native network configuration](docs/NETWORKS.md). The repository is a prototype; production hosting is a separate roadmap milestone.

## Loading, pausing and unavailable data

- All contract reads for a network in a refresh use one fixed block on that network. Multicall batches are bounded, with fallback splitting for provider gas/size caps; v3 fee collection is simulated directly with the owner's address through `eth_call`.
- All enabled networks share one conservative serial RPC credit budget, with transient retries, request timeouts and cancellation. Retries use the same budget. Pause cancels the request/retry wait. The application has no transaction-sending code.
- v4 does not support ERC-721 enumeration. Discover incoming Transfer events in contiguous windows, verify candidates with `ownerOf`, and save each completed window. Smaller provider limits shrink the window without advancing across a failed request. A 24-block overlap is replayed on resume. Matching the live NFT balance at the same block proves when all current owners are accounted for, allowing discovery to finish early.
- Each refresh scans at most 120 successful windows per v4 network. **Refresh** continues from saved progress, including after a reload and re-entering the key. Restricted public providers can need many refreshes; use an Infura project with suitable historical-log access for larger portfolios. A lagging node never rewinds a saved cursor. **Clear saved v4 scan** restarts discovery for the entered wallet on every network. Enabled-network selection is validated and saved separately; an empty selection cannot be submitted.
- Each network displays its block, update time and availability. A failed/incomplete refresh retains its previous in-memory snapshot, labelled stale, while successful networks advance. Totals remain partial and explicitly include those stale values; snapshots are never persisted. A first unavailable read stays unknown, including when every other network is empty.
- A failed read, incomplete discovery or missing token metadata is not a zero balance. Positive tokens missing prices leave USD unavailable; totals explicitly identify partial coverage. CoinGecko has a DefiLlama fallback. Known zero fees remain zero, and dust is not rounded into a false empty balance.

## Checks

```bash
npm test
npm run check:brand
npm run build
npm run preview
npm run test:live
npm run test:networks
```

The offline tests use encoded JSON-RPC/ABI fixtures and native parity cases. The existing Ethereum live check reads public on-chain samples at runtime, exercises v3 reads and complete v4 discovery, and prints only block/count/status evidence. It stores no wallet address, key or portfolio capture. `POOLSER_RPC_URL` can select another RPC for the live check; supply credentials through your process environment, never source files or command arguments. A sample's availability/ownership or a public provider's limits can change, so the live check is separate from deterministic tests. See [validation](docs/VALIDATION.md) for actual checks and observed limits.

`npm run test:networks` checks the configured public RPCs with a fictional address and prints only sanitized per-chain block/count/status evidence. It exits nonzero if any provider is unavailable. Provider results are observations, not guaranteed availability; see [validation](docs/VALIDATION.md).

Shared identity is pinned in [docs/brand/manifest.json](docs/brand/manifest.json). Web interface adaptations are documented in [docs/BRAND.md](docs/BRAND.md), with [prototype data flow](docs/PRIVACY.md) separately from the native privacy policy. Keep adopted files local; update hashes and the reviewed brand revision together. No build fetches brand resources or fonts. Live token/network icons use the same public artwork sources as native with an in-memory cache and stable fallbacks; demo icons are pinned locally. For manual presentation edge cases, run the dev server and open `/tests/presentation.html` (fictional data and public artwork only; excluded from the production build). See the [native parity checklist](docs/NATIVE_PARITY.md) for remaining work.

## Next milestones

Saved wallets/All Wallets, fee history/realized returns, wallet collection and production deployment have separate [roadmap issues](https://github.com/poolser-app/.github/issues/1). Native menu-bar integration and widgets remain native features.

- [native](https://github.com/poolser-app/native): implementation reference and financial fixtures.
- [brand](https://github.com/poolser-app/brand): shared guide and original artwork.
- [website](https://github.com/poolser-app/website): product presentation, downloads, support and privacy pages.

Poolser is an independent project with no affiliation, association or connection to Uniswap Labs or the Uniswap Protocol. “Uniswap” is a trademark of Uniswap Labs. MIT; see [LICENSE](LICENSE).
