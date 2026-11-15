# Poolser web

Poolser in the browser. Repository initialized; implementation has not started.

The browser application will monitor public Uniswap v3/v4 liquidity positions, portfolio value, unclaimed fees, ranges, fee history and realized return across saved wallets, including All Wallets. Monitoring a public address does not require wallet connection. Fee collection will use the user's browser wallet to review and sign transactions.

## First milestone

Validate one public wallet on one chain with both v3 and v4 positions, using the user's own Infura key. Check browser access to RPC and pricing services, correct values, request pacing, resumable discovery and local storage before expanding to feature parity. A shared RPC backend is a separate product/privacy decision.

Port and verify financial rules against the native test cases. Preserve exact integer arithmetic where required, token decimal scaling, range semantics and the distinction between zero, syncing and unavailable data. Browser refresh/background limits and locally observed v4 history must be represented honestly. Native widgets and menu-bar integration remain native platform features.

## Related repositories

- [brand](https://github.com/poolser-app/brand): shared guide, original artwork and colour tokens.
- [native](https://github.com/poolser-app/native): reference implementation and financial test cases.
- [website](https://github.com/poolser-app/website): product presentation, downloads, support and privacy.

Use a reviewed brand commit and keep required exports locally. Hosting, the app subdomain and runtime dependencies are not configured yet. Wallet keys and signing stay in the user's wallet; provider credentials must never be committed.
