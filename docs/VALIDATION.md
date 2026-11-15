# Prototype validation

Checked on 2026-11-15. Evidence below uses public chain samples and fictional demo screenshots. No personal Infura key, private wallet configuration, real portfolio screenshot or captured RPC payload is committed.

## Deterministic checks

- `npm test`: 22 passing tests. Native parity cases cover uint256 subtraction/wraparound, high fee-growth accumulators and Q128 flooring, signed v4 packed ticks, pool IDs, holdings with token decimal scaling, quote orientation, lower-inclusive/upper-exclusive range boundaries, near-edge/full-range states, zero/dust and unavailable prices/reads.
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

The local Vite app is tested in the in-app WebKit browser. Desktop light/dark and 390px mobile layouts use the shared original artwork/tokens. The mobile summary stacks without splitting money values. Choosing demo focuses the portfolio on small screens; Position Details opens/closes with Enter; invalid address submission gives a visible alert. Demo uses two fictional positions, one in range and one out of range.

A real public dRPC browser read completed at block **26420593** with **one funded v4 position**, readable holdings, nonzero fees, USD value and labelled range. The UI showed **Read complete**. CoinGecko failed in the browser and DefiLlama supplied the fallback price; the notice remained visible. Pausing an in-progress scan produced the explicit partial state. After reload, the wallet was remembered and discovery resumed from saved progress to completion. A fictional key entered without submitting any request disappeared after reload; no real credentials were used. The sample scan checkpoint was cleared after QA.

Screenshots contain fictional demo data and blank address/credential inputs:

- [Light desktop](screenshots/demo-light.jpg)
- [Dark desktop](screenshots/demo-dark.jpg)
- [Mobile](screenshots/demo-mobile.jpg)

## Provider behaviour and limits

- dRPC's public Ethereum endpoint responded to localhost CORS preflight with an allowed origin and to a JSON-RPC POST with `Access-Control-Allow-Origin: *`. Its free provider responses can reject oversized log ranges with HTTP 400 / JSON-RPC code 35. Observed effective upstream windows shrank as low as 78 blocks. The app learns the smaller window, saves contiguous progress and bounds each refresh to 120 successful windows. A large or recently funded wallet can require many resumes; a suitable Infura project is preferable for that workload.
- PublicNode answered ordinary Ethereum reads but rejected historical logs with HTTP 403 and an archive/personal-token requirement. This is classified as access unavailable rather than an empty portfolio. It is not the selected UI public provider.
- CoinGecko was restricted/unavailable in the live environment. DefiLlama supplied the sample prices. These services have independent availability, CORS, rate and coverage limits; missing prices leave USD unavailable and partial totals explicit.
- Browser contract metadata comes from ERC-20 reads through the selected RPC, avoiding a separate metadata service or token-icon dependency. A failed decimals read never guesses 18.
- Personal Infura credentials and a project's allowed-origin/archive configuration were not supplied for this run. The Infura input/path, memory-only key handling and redacted failure behaviour are implemented; a live credentialed Infura check remains a user-project configuration check before release.

This is a local read-only Ethereum prototype. Multichain support, saved portfolio history, transaction signing/Collect, production hosting, response security headers and a release are separate roadmap milestones.
