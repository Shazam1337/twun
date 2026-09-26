# Odado linear ratio perpetual — multi-market real-data demo model v4

Each pair is one synthetic cash-settled Odado contract. R = first stock USD price / second stock USD price.
Choose any two different stocks from a curated 50-stock, 11-sector catalog; not an exact cap ranking.
The 1,225 unordered combinations are computed indices, not existing exchange markets or liquidity claims.
Inverse orientations share one catalog entry but have distinct position identities and payoff paths.
No spot token swap, expiry, share ownership, or automatic pair of stock positions.
USDC is the demo settlement unit (fixed 1 USD for this simulation).

## Position accounting

Initial isolated margin M, leverage L in integer steps 1–10, fixed entry notional N = M × L.
Direction d = +1 for Long, −1 for Short. Entry ratio R0; current demo index/mark R.
PnL = d × N × (R / R0 − 1). This is a linear demo payoff, not a live exchange specification.
Position size is the fixed entry notional in USDC, not a number of underlying shares.

Opening fee = 0.05% × N, charged from free USDC in addition to M.
Closing fee = 0.05% × N, charged from position settlement. Both use fixed entry notional.
Funding F is signed: positive means paid, negative means received.
Isolated equity E = M + PnL − F. Entry fee is already deducted from free balance.
On closing, payout = max(0, E − closing fee) is credited to free USDC.
Net realized result = payout − M − entry fee. This includes funding and both fees.
Account equity = free USDC + sum of open isolated equities. Open PnL is not spendable free balance.

## Maintenance and liquidation

Maintenance requirement MM = 5% × N (fixed entry notional).
Liquidate when E <= MM, including a funding-induced breach. Equality is included.
Calculated liquidation ratio Rliq = R0 × [1 + d × (MM − M + F) / N].
Long liquidates at/below Rliq; Short at/above it. Funding changes Rliq.
The displayed estimate excludes future funding and does not promise a fill at the threshold.
The demo uses the submitted mark for settlement; a jump past Rliq liquidates at that mark.
There is no additional liquidation penalty. The ordinary closing fee still applies.
No losses are debited from other positions or free funds: a negative residual is capped at zero.
Any gap deficit, including unpaid closing fee, is recorded as a simulated shortfall in history.
The demo assumes an external insurance backstop for that amount; no real insurance fund exists.
Each opening creates an independently isolated position, even on the same contract.

## Funding and clock

Fixed illustrative funding rate +0.01% of N per 8 simulated hours: Long pays, Short receives.
Each position accrues from its opening simulation time. There is no prorating.
The “Advance 8h” control charges/credits eligible positions of the SELECTED oriented pair only and then checks maintenance.
Changing the ratio does not advance time. Reloading or leaving a tab open does not accrue funding.
The chart uses provider history only; local funding/position events never create chart prices.
Each pair has its own simulation clock. Only its Advance 8h changes that clock.
Switching the chart or reversing its ratio never revalues, funds, or liquidates a different pair.
Real quote timestamps are separate from simulation time and are saved with each entry.
Index = demo mark is an explicit simplification, not a tradable perpetual quote. Spread/slippage are zero.
A valid new index updates PnL and checks liquidation in one local transition. No manual mark control.

## Worked example

100 USDC margin × 5 = 500 USDC entry notional.
Entry 0.50 → mark 0.55: Long PnL = +50.00 USDC; Short PnL = −50.00 USDC before costs.
Opening fee 0.25; closing fee 0.25; one 8h funding payment 0.05 for Long (credit for Short).
Long net on close without funding = +49.50; after one interval = +49.45 USDC.
At entry, Long Rliq = 0.425; Short Rliq = 0.575; MM = 25 USDC.

## Persistence and integration boundary

The v4 real-data account uses odado-perps-v4 and starts with 10,000 demo USDC and no index.
A valid v3 account migrates once: existing NVDA/TSLA positions retain every original parameter,
mark, ID, fee, funding amount and source timestamp. The v3 key remains unchanged as a backup.
The original pair-perps-demo-v2 key is preserved byte-for-byte and copied once to
pair-perps-demo-v2-archive. The old pair-demo-state-v1 spot account is also untouched.
No synthetic position, balance or mark is migrated. Reset affects only v4.
Each position stores its oriented pair, its own accepted mark, dataSource, entryIndexTime (oldest of the two source timestamps), and entryIndexId.
Prices come from the server; execution, funding, collateral and liquidation remain local simulations.
Phantom/Solflare connections remain independent. No signatures, transactions, real oracle, venue,
matching engine, or liquidation keeper are integrated. Browser storage is not secure collateral accounting.

## Feed and index semantics

R = current underlying first-stock USD price / current underlying second-stock USD price.
Source: Twelve Data standard US equities feed. These are NOT xStocks token quotes or an existing
perpetual-market price. The standard feed covers roughly 5% of US trading volume, not consolidated
all-venue prices; results can differ from other sources. No invented fallback values are provided.

Server requests /quote for selected-pair and open-position stocks, grouped by NASDAQ or NYSE,
with interval=1min, timezone=UTC,
prepost=false. Both symbols must be present, correct and USD-denominated. Prices and source
timestamps must be finite and positive. is_market_open must be a boolean for both instruments.
last_quote_at is required: Twelve Data defines it as the last minute candle timestamp.
The quote timestamp field is bar-open time and is NOT substituted for last_quote_at.
The displayed times are provider minute observations, not individual tick/trade timestamps.

The pair is accepted atomically; an incomplete, invalid or out-of-sync batch retains the previously
accepted pair and flags the feed as unavailable for trading. Both symbol statuses and timestamps must pass before the derived pair index is accepted.
Shared cached stock observations are reusable within freshness/skew limits; failed or stale symbols
cannot be combined with a recovered symbol to resume a position. Each pair is gated independently.
Allowed quote skew: <=60 seconds. Maximum age of either quote: 5 minutes. Future tolerance: 10 seconds.
These thresholds are conservative demo choices, not provider latency guarantees. Delayed entitlements
may fail this freshness gate. During an open session, stale new prices do not replace the cache.

When invalid, disconnected, unknown-session, or stale during an OPEN session, position valuation
stays at the last accepted index and operations are blocked. Scheduled closures alone do not
block LOCAL DEMO opening/closing: use the last valid synchronized snapshot, without an age cutoff.
All symbol, USD, finite positive price, future-time and 60-second skew validations still apply.
API failures are not treated as closures; failed symbol statuses block trading even with cached prices.
The UI identifies closed-session demo prices and displays their source time. No artificial movement.
Funding is paused outside the regular session: Advance 8h is disabled and rejected, with no overnight
accrual or catch-up. Fees and margin equations remain unchanged. Each accepted REAL ratio change
can revalue the account; unchanged prices leave gross PnL unchanged.
After reopening, the closure exception ends immediately. Both observations must again be fresh
and provider open flags must be true; old Friday data cannot price Monday trades.
Recovery adopts a fresh complete pair and resumes valuation atomically,
including gap liquidation at the recovered mark. A feed pause does NOT imply economic risk stopped.

## Historical close-ratio series and split policy

/time_series is cached independently per stock and loaded on demand with identical intervals and adjust=none, prepost=false.
5min (1000 bars) serves 1D/7D; 1day (400 bars) serves 30D/90D/1Y.
Both series use UNADJUSTED prices. Current /quote prices are current nominal share prices; quote
has no adjust parameter. Explicit adjust=none overrides the daily history's default split adjustment
and agrees with unadjusted intraday prices. No dividend adjustment is applied.
Thus this is a raw nominal-price ratio, not a split-neutral or total-return index: stock splits can
cause real discontinuities and simulated PnL/liquidation. Do not use this simplified model for real
contracts; corporate-action continuity requires a separately designed index and contract migration.

Intraday timezone=UTC is honored: parse exactly YYYY-MM-DD HH:mm:ss as UTC candle-open time.
Only completed 5-minute bars are used. For daily bars, the provider ignores timezone; match the
exchange session dates exactly and normalize them to New York midnight (DST-aware).
Today's daily bar is excluded; completed daily history consequently ends at the previous session.
Match closes ONLY at identical normalized times and intervals. Compute close(first)/close(second).
No high/high or low/low candles, forward filling, interpolation of missing prices or random points.
Unmatched timestamps become null gaps in the chart, not ratio observations.
The line connects matched closes linearly; no fabricated intrabar path.
Percent change = (last available ratio close / first available ratio close - 1) × 100, not the
provider's per-stock percent_change and not quote-vs-history. A selected window ends at the last
available historical bar; coverage and observation count can be smaller than its nominal span.
Cached histories retain their own fetch time and error status; history failure does not invalidate
an independently fresh current quote. An absent history is explicitly empty, not synthetic.

## Sessions, polling and quota

The regular session calendar uses America/New_York and its DST rules, 09:30–16:00, plus official
2026–2027 NYSE/Nasdaq holidays and 13:00 shortened days. Other years fail closed until reviewed.
Both quote is_market_open flags must also be true; provider-reported closures override the calendar.
This static schedule cannot independently predict extraordinary closures/halts. It relies on the
provider flags and five-minute freshness cutoff for unexpected events.

The server polls on demand at most once per 120 seconds while regular trading is open, shared
across all visitors. This is periodic REST polling, NOT a tick stream. Browsers check the shared
API every 15 seconds and recheck freshness locally; no visitors means no background polling.
Outside regular hours, retain the last values with Market closed. A cold start/ET date change and
an expired 6h cache may fetch latest regular-session values. Pre-session cache is invalidated at opening.
An unchanged last ratio does not move PnL. A changed validated real ratio revalues positions;
reopening gaps can trigger liquidation at the recovered mark, not the displayed liquidation threshold.

5min history has a separate 30-minute TTL; daily history has a 6-hour TTL. All windows reuse these
two cached datasets. Quotes take priority. Every dispatched batch reserves one credit PER SYMBOL before
network I/O, including failed attempts and retries. Quote/time_series/logo each cost 1 credit per symbol.
Default hard application budgets: 8/minute, 750/UTC day (below Basic 800/day).
A full 390-minute session is about 390 quote credits + 26 intraday-history credits + a few daily/
closure credits, before retries. Actual entitlement and other API consumers can reduce headroom.
Use a dedicated key, or lower budgets/increase the poll interval for the share allocated to Odado.
Account quotas cannot be inferred without a configured key. Users share symbol caches; different new symbol demands still consume credits.
Four stocks polled for a full session cost about 780 quote credits before histories: Basic cannot
sustain a large concurrent portfolio at 120s. Quota-limited pairs pause rather than use invented data.

HTTP 429 sets a shared Retry-After-aware exponential cooldown (60s to 15min base; a longer provider
Retry-After is honored). Retries happen on a later API check, never an unbudgeted immediate loop.
Access denial is cached for 10 minutes. Network/invalid quote retries wait at least 120 seconds.
Calls abort after 8 seconds each. All provider messages are replaced with sanitized statuses.
The local budget and cache journal survives restarts in .cache/pair-twelve-data-v1.json.
Do not delete/reset it during the quota day. Journal write/read failure fails closed.
One Node process on durable local disk ONLY. No multi-worker PM2, serverless replicas or multi-instance
deployment: a distributed shared cache, lock and quota counter are required first.

## Official references and display rights

- [Twelve Data API documentation](https://twelvedata.com/docs)
- [Timezone rules](https://support.twelvedata.com/en/articles/5745849-timezones)
- [Price adjustment rules](https://support.twelvedata.com/en/articles/5179064-are-the-prices-adjusted)
- [US equities coverage and distribution](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)
- [Credits and reset windows](https://support.twelvedata.com/en/articles/5615854-credits)
- [Plans and entitlements](https://twelvedata.com/pricing)
- [Official holiday/early-close calendar](https://www.nyse.com/trade/hours-calendars)

API access and display/redistribution permission are different. Basic is not assumed to authorize
a public terminal. Confirm the appropriate plan and US Equities / Redistribution Rights Add-On
for external distribution before exposing this app to others. No plan was purchased and no public
deployment was performed. Documentation checked 24–26 September 2026.
