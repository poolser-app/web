# Native → web parity checklist

Audit baseline: [native 7c1e0ab](https://github.com/poolser-app/native/tree/7c1e0ab22bc952626d7dd18de14645c07ecacad6). The one-wallet/Ethereum prototype is in [PR #7](https://github.com/poolser-app/web/pull/7); it is not the full native product. The complete scope/order and acceptance criteria live in the [organization roadmap](https://github.com/poolser-app/.github/issues/1) and the issues below.

| Order | Remaining capability | Issue |
| --- | --- | --- |
| 1 | Original token/network artwork, stable fallbacks/cache, native fee/price/amount presentation, accessible clamped ranges and long labels | [#8](https://github.com/poolser-app/web/issues/8) — implemented on this branch; review pending |
| 2 | Every native-supported chain/version, prices/native assets, enabled networks, global request budget and isolated/stale chain state | [#2](https://github.com/poolser-app/web/issues/2) |
| 3 | Pool references, 24h Volume/TVL/estimated yield, Assets/Position details and responsive Open in Uniswap action; later #4 supplies real dates/returns | [#9](https://github.com/poolser-app/web/issues/9) |
| 4 | Named/reordered wallets, All Wallets allocation/cards/navigation, persisted snapshots, full filters/sorts, hide/restore/copy/context actions | [#3](https://github.com/poolser-app/web/issues/3) |
| 5 | Opening dates, v3 claimed scans, v4 observations, 7/14/30D and Today charts, daily mini bars, realized/weighted APR and eligible pool-level values | [#4](https://github.com/poolser-app/web/issues/4) |
| 6 | Original crest/eyes entrance/blinks, linear fee water and pouring/settling, reduced motion and visibility cancellation | [#10](https://github.com/poolser-app/web/issues/10) |
| 7 | Refresh/RPC/log settings, lifecycle/offline/reconnect, claimed tracking, theme/preferences, optional range alerts and sanitized diagnostics | [#11](https://github.com/poolser-app/web/issues/11) |
| 8 | Native Collect/card/batch review, wallet/network/account validation, simulation/gas, signing, pending/receipt and partial-failure reconciliation | [#5](https://github.com/poolser-app/web/issues/5) |
| 9 | Native screenshot/wording and financial-state acceptance, desktop/mobile/enlarged text, keyboard/screen readers/contrast, browser matrix and production release | [#6](https://github.com/poolser-app/web/issues/6) |

Each implementation must preserve known zero versus unknown/partial/syncing/stale, hide exclusions versus display-only filters, native information hierarchy and original locally pinned Poolser artwork. Do not invent a different web slogan, duplicated form headings or fabricated history. Required data/actions and truthful failures matter alongside appearance.

The web adapts native sheets, pointer/keyboard/touch navigation and refresh to browser controls. macOS menu-bar integration/source/flash/Quit, launch at login and WidgetKit remain native; a closed/suspended browser is not a background monitor. No account/cloud sync/shared RPC backend, PWA install or push service is implied. Production domains, hosting/privacy and the separate landing/download website remain separately tracked in the roadmap.

PRs can stack on the open prototype branch with explicit dependencies; do not merge a predecessor implicitly. An implemented issue remains open until its implementation is merged/reviewed. Work through one reviewable task at a time.
