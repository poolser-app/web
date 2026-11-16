# Supported networks

Source: native [ChainConfig.swift at 2156823](https://github.com/poolser-app/native/blob/215682391bcacc9ccb55f2e051bddd608512b42f/Sources/PoolserKit/ChainConfig.swift), [v3 loader](https://github.com/poolser-app/native/blob/215682391bcacc9ccb55f2e051bddd608512b42f/Sources/PoolserKit/Loading/V3PositionLoader.swift), [v4 loader](https://github.com/poolser-app/native/blob/215682391bcacc9ccb55f2e051bddd608512b42f/Sources/PoolserKit/Loading/V4PositionLoader.swift) and [NetworkIconStore](https://github.com/poolser-app/native/blob/215682391bcacc9ccb55f2e051bddd608512b42f/Sources/PoolserKit/NetworkIconStore.swift). The local reviewed configuration is [src/networks.ts](../src/networks.ts); builds and tests do not need the native checkout. It preserves deployment addresses/blocks, wrappers, Infura host templates, price IDs, original network artwork and Uniswap slugs. Provider availability is separate from protocol capability.

| Network | Chain ID | Versions | Native symbol in reference | CoinGecko / DefiLlama | Uniswap slug |
| --- | ---: | --- | --- | --- | --- |
| Ethereum | 1 | v3 + v4 | ETH | ethereum / ethereum | mainnet |
| Base | 8453 | v3 + v4 | ETH | base / base | base |
| Arbitrum | 42161 | v3 + v4 | ETH | arbitrum-one / arbitrum | arbitrum |
| Optimism | 10 | v3 + v4 | ETH | optimistic-ethereum / optimism | optimism |
| Polygon | 137 | v3 + v4 | POL | polygon-pos / polygon | polygon |
| Blast | 81457 | v3 + v4 | ETH | blast / blast | blast |
| Avalanche | 43114 | v3 | AVAX | avalanche / avax | avalanche |
| Celo | 42220 | v3 | CELO | celo / celo | celo |
| ZKsync | 324 | v3 | ETH | zksync / era | zksync |
| BSC | 56 | v3 | BNB | binance-smart-chain / bsc | bnb |
| MegaETH | 4326 | v3 | ETH | megaeth / megaeth | megaeth |
| Monad | 143 | v3 | ETH | monad / monad | monad |
| Unichain | 130 | v3 + v4 | ETH | unichain / unichain | unichain |

Palm (11297108109), Linea (59144) and Mantle (5000) exist in native configuration with no supported v3/v4 deployment. Settings identifies that explicitly and prevents enabling them. v3-only networks never issue v4 ownership/history/state requests. ZKsync uses its native Multicall3 at `0xF9cda624FBC7e059355ce98a31693d299FACd963`; the other supported networks use the canonical deployment.

Native v4 currency address zero remains unchanged for PoolId/contract math. Metadata uses the reference native symbol and 18 decimals; prices and artwork use the chain’s wrapped asset. ERC-20 symbols and decimals always come from that network’s contract reads. Unknown decimals/prices are never guessed.

## Selection and providers

Ethereum is the initial default. Settings saves a nonempty, unique set of supported numeric chain IDs in `poolser:enabled-networks`. Corrupt, empty or unsupported persisted selections produce a visible fallback notice. A storage failure preserves the tab’s selection with a notice. Cancelling Settings restores unsaved selection changes. Network selection does not save a provider key.

Public endpoints are network-specific dRPC hosts, except `mainnet.megaeth.com/rpc` and `rpc.monad.xyz`. Settings lists the exact host before Save; choosing public RPC never sends the Infura field. Infura uses the native host templates and requires that the user’s project actually allow the selected network/origin and historical access. An endpoint returning the wrong chain ID is rejected before contract, price or discovery reads. See [data flow](PRIVACY.md).

On 2026-11-16 the fictional-address integration check completed on 12 networks. Blast’s public dRPC endpoint answered chain ID but rejected block-number reads; alternate public endpoints were unavailable in this environment. It remains unavailable in the UI, with partial totals, rather than being represented as an empty wallet. A public endpoint may change availability or impose range, CORS, archive or rate limits. [Validation](VALIDATION.md#supported-networks-2) records actual evidence; deterministic fixtures cover all supported configurations independently of these services.

## State and work isolation

Every network has its own fixed block, last available update time, positions, warnings and availability status. Successful networks publish independently. Until a replacement finishes, previous chain data remains visible; an incomplete/failed replacement retains that entire prior fixed-block snapshot as stale, including its original timestamp. A first partial read can display known positions, while an unavailable first read stays unknown. Aggregate totals include known/stale values with explicit partial labels. A lagging node cannot rewind a saved discovery cursor.

Position identities contain wallet + numeric chain + version + NFT ID. v4 checkpoint keys contain wallet + chain + version; candidate IDs and learned log-window sizes live inside those isolated checkpoints. Metadata/price maps are scoped to each chain refresh, and artwork keys include chain/address. No portfolio snapshot or price is persisted. Changing wallet, deselecting a network or switching to demo cannot import another wallet/chain’s positions.

All enabled networks use a shared serial credit queue: 400 credits/second, 80 credits per ordinary request, 255 per log request. Every retry re-enters that same budget, allowing other chains to proceed during backoff. The page retains the budget across refreshes. Pause aborts requests and retry waits; completed discovery windows survive. Each v4 network retains the 120-window refresh bound, contiguous adaptive chunks, 24-block overlap and fixed-block ownership reconciliation. Multicall batches remain bounded/splittable; v3 collect stays an owner-origin `eth_call` simulation. No transaction is submitted.
