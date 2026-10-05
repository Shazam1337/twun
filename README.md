# TWUN — stock-performance ratio demo

A curated product catalog of 50 large US stocks across 11 sectors, not an exact market-cap ranking.
Choose any two different stocks. All pair markets are synthetic TWUN markets, not externally listed
perpetual contracts. No stock ownership or tokenization. Execution, collateral, funding and liquidation
remain local simulation; EVM wallet connections are real and independent.

## Run locally — one Node process

```sh
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Copy .env.example to .env.local and configure only server variables:

```dotenv
TWELVE_DATA_API_KEY=
TWELVE_DATA_DAILY_BUDGET=750
TWELVE_DATA_MINUTE_BUDGET=8
TWELVE_DATA_QUOTE_SECONDS=120
```

Restart after changing environment variables. Never use NEXT_PUBLIC_ for this key, print it,
put it in URLs, screenshots, client code or git. Provider requests use Authorization headers.
Without a key the UI shows “Market data not configured”; trading is blocked, with no invented prices.
Preview: http://127.0.0.1:3000 — overview, /trade, /portfolio.

## Data and limits

GET /api/market?base=AAPL&quote=MSFT&watch=NVDA,TSLA&interval=1day returns a pair feed, underlying
quote cache, catalog availability and remaining budget counters. Only catalog symbols and distinct
pairs are accepted. Watch symbols come from open positions. Quote demand is the union of selected
stocks and position underlyings; common stocks are fetched once. Histories load only on demand for
the selected pair/interval. No enumeration or polling of the 1,225 unordered combinations.

Quotes refresh no faster than 120 seconds during the regular session. Browser checks every 15s are
cache checks, NOT ticks. Off-session cached values show Market closed; initial/expired checks use
a 6-hour TTL, shortened to the next regular opening when appropriate. At opening, pre-session
cached observations must refresh. Quotes have priority over history. 5min history: 1000 bars,
30min TTL; 1day history: 400 bars, 6h TTL. Reverse pairs reuse the same underlying series.

Each /quote, /time_series or /logo symbol costs one API credit, including failed requests and retries.
Default hard budgets are 8/minute and 750/UTC day, below Basic's 800/day. One two-stock pair needs
roughly 390 quote credits per full session, before history, closures and retries. Four continuously
watched stocks already need about 780 quote credits/day: Basic cannot support every combination
or a large concurrent portfolio at this cadence. Explicit quota statuses pause affected pairs;
increase the polling interval or arrange suitable access rather than substituting prices.
The app cannot count unrelated clients using the same provider account: use a dedicated key
or allocate a smaller share of the budget. No plan is purchased automatically.

Requests are serialized/deduplicated against a shared symbol cache. Timeout: 8s per provider call.
429 uses shared exponential/Retry-After backoff; no unbudgeted immediate retries.
Durable cache/quota journal: .cache/pair-twelve-data-v1.json, ignored by git, contains no secrets.
Counters are persisted BEFORE dispatch. Never delete it to reset daily consumption.
One Node process on durable disk ONLY; no serverless/replicas/PM2 cluster. Distributed cache,
locks and atomic quota accounting are required before scaling to multiple instances.

## Catalog availability audit

Authenticated responses have been checked with the configured key. Per-symbol results, times,
observation counts and provider logo URLs are stored in the catalog journal. The selector exposes
availability; successful API access is not a guarantee of freshness or display rights.
Audit completed 26 September 2026: 50/50 quote responses, 50/50 five-minute histories,
50/50 daily histories and 50/50 logo URLs validated. One transient 429 recovered on retry.
The 28 unit tests, production build and multi-pair browser scenario passed.
To resume a full audit, stop the app first and run this single-process, budget-limited script:

```sh
node --import tsx scripts/catalog-audit.ts
```

It reuses the SAME quota journal. Do not run it alongside the app. It checks /quote, 5min/daily
/time_series and /logo for each stock, with no fabricated response data. Results are written
to artifacts/catalog-availability.json. Provider restrictions remain explicit.
GET /api/catalog is a read-only cached report. The local verification endpoint also supports
?verify=SYMBOL, shares quotas, and must not be exposed as a public unauthenticated service.
Logos use validated HTTPS URLs returned by Twelve Data; missing logos fall back to ticker initials.

## Pair model and storage

See [perps-model.md](public/perps-model.md), served at /perps-model.md.
R = first stock's USD price / second stock's USD price.
Gross PnL = direction × margin × leverage × (R / entry R − 1).
100 USDC × 5x, 0.50 → 0.55 gives Long +50 gross, +49.50 after entry/exit fees,
or +49.45 after one modeled funding interval. Maintenance is 5% of entry notional.

Each oriented pair keeps its own accepted index and funding clock. Switching/reversing the chart
does not change another position's market, PnL or liquidation state. Portfolio totals use each
position's own accepted mark. Open/close use a valid synchronized index FOR THAT PAIR. During an open session both quotes
must be fresh and provider flags must confirm trading. During scheduled closures, local demo
orders use the last valid synchronized prices regardless of quote age. Missing/invalid quotes,
API failures, quota errors and unknown sessions still block operations. A broken symbol freezes only its dependent pairs.
History availability is independent of quote validity.

Quotes: positive finite USD prices; last_quote_at required; <=5min age, <=60s skew, <=10s future.
New York calendar includes DST, official 2026–27 holidays/early closes, plus provider open flags.
Unknown calendar years fail closed. Recovery adopts both validated quotes atomically.
History joins completed close(first)/close(second) at identical normalized timestamps/intervals.
Intraday UTC; daily New York session dates. adjust=none for BOTH series, current nominal quotes.
Splits can create discontinuities and demo liquidation. No fabricated candles, missing-price
interpolation or dividend adjustment. Percent change uses ratio-history endpoints, not stock returns.

Storage: odado-perps-v4. A valid pair-perps-twelve-v3 account migrates once, retaining all IDs,
margin, fees, funding, entry/source timestamps and existing marks. Old v3 bytes remain untouched.
No old synthetic v2/spot positions are imported. Their original keys and the v2 archive remain.
Reset affects only v4. Favorites and selected pair are separate local preferences.
Demo positions never request wallet signatures, POST trades or send transactions.

## Verification and structure

```sh
npm test
npm run typecheck
npm run build
npm run test:browser
node scripts/browser-multi.cjs --capture
node scripts/browser-weekend.cjs # actual-data test; run while the regular session is closed
```

Browser tests require Google Chrome; ODADO_URL overrides localhost:3000.
They use an isolated profile and explicitly intercepted TEST responses for execution scenarios,
not fallback market data. --capture is separate: actual API pages only, no fixture prices/positions.
Tests cover multi-pair accounting, reciprocal indices/history, migration, independent failures,
429/budgets/cache reuse, sessions, fees, liquidation, reload and missing-wallet-extension states.
Real extension authorization cannot be verified in the extension-free automated browser.

Core modules: catalog.ts (curation), market.ts/universe-feed.ts (public models),
twelve-normalize.ts (validation), universe-provider.ts/twelve-provider.ts (cache/transport/quota),
market-server.ts (server secret + journal), multi-account.ts (pair-scoped accounting),
perps.ts (preserved formulas), market-store.tsx/demo-store.tsx (UI data/local execution).

## Before public use

[Twelve Data documentation](https://twelvedata.com/docs),
[credits](https://support.twelvedata.com/en/articles/5615854-credits),
[US equities coverage](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data),
[plans](https://twelvedata.com/pricing).

The standard US equities feed covers roughly 5% of US volume, not consolidated all-venue data.
Entitlement and display/redistribution rights are separate. Basic is NOT assumed to permit a
public terminal. Confirm the appropriate plan and US Equities / Redistribution Rights Add-On
before external distribution. No plan was bought; nothing was published.

Real execution, on-chain collateral/oracle/contract, keepers, live funding, corporate-action-neutral
index and production security remain out of scope. Jupiter spot routes are not a perps engine.
## Robinhood Chain wallet connection

The wallet target is Robinhood Chain mainnet (4663 / 0x1237), not Ethereum mainnet
and not a Robinhood brokerage account. Configuration comes from
[Robinhood documentation](https://docs.robinhood.com/chain/add-network-to-wallet/).
Browser wallets are discovered via EIP-6963 with an EIP-1193 legacy fallback.
MetaMask, Rabby and other installed EVM providers appear when detected. Address access
requires an explicit Connect click; there is no auto-connect or signing request.
Network switching/adding is a separate user action. Account, network and disconnect
events update the UI. Disconnect is local; revoke permissions inside the extension.
No WalletConnect mobile QR integration is included; Robinhood Wallet mobile users need
an injected EVM browser provider. A setup link is provided, not a fake desktop connector.
Demo storage keys, positions, fees and Twelve Data remain unchanged and wallet-independent.
No live execution, tokens, deposits, contract deployment or on-chain transactions were added.

## Homepage stock tape

`/api/ticker` reads the same server cache for all 50 catalog stocks; it never requests
additional provider data or changes trading marks. The homepage polls this local endpoint
every 30 seconds. Symbols update when the existing selected-pair/open-position workflow
refreshes them, not via an all-catalog subscription. Old prices have visible Cached timestamps;
provider failures retain a dated price with Update unavailable. Missing prices/history show —.
The 24h percentage is `(quote / historical close - 1) * 100`, relative to the displayed
quote's timestamp, not necessarily the current wall clock. The reference is the completed
unadjusted 5-minute close at or immediately before quote time minus 24 hours (less than
5 minutes tolerance). No interpolation, weekend carry-forward or daily-change substitution.
Twelve Data `/quote` change refers to the previous bar and is intentionally not labeled 24h.
See [official documentation](https://twelvedata.com/docs). Existing feed-display rights apply.
The tape loops continuously, including hover/focus; reduced-motion slows its speed.
Clicking a stock opens Trade with that stock / TSLA; TSLA itself opens TSLA / NVDA.
This only selects the market, never opens a position or requests a wallet signature.

## Closed-session local demo rule

The UI shows “Market closed · Demo trading at last available prices” with source timestamps.
Price age is waived only for known scheduled closures; symbol/currency/positive-price checks,
60-second skew, future-time checks and feed connectivity remain enforced. No synthetic price
movement occurs. PnL changes only when the actual ratio changes; fees still apply to opens/closes.
Funding is paused outside the regular session: Advance 8h is disabled and rejected by execution,
no wall-clock accrual and no overnight catch-up. At reopening, old snapshots are rejected until
both quotes are fresh and synchronized. The recovered ratio updates PnL and checks liquidation
atomically, including liquidation at a gap price. This does not imply real after-hours liquidity.
