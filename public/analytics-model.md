# TWUN Analytics methodology

Analytics is historical research, not investment advice, executable prices or trading signals. The 50-stock catalog is a product selection across sectors, not a complete US market or an exact capitalization ranking.

## Daily prices and risk

Twelve Data `/time_series`, `interval=1day`, `adjust=none`, 400 observations per stock. Analytics requests only the two selected histories through the existing server-side symbol cache and shared quota; no new quotes, all-catalog price polling or new market marks. Cache TTL is 6 hours. Timeframe filters (30/90/180/365 calendar days) run locally, anchored to server time. Actual first and last observations and counts are displayed. Missing periods are not invented or presented as full coverage.

Daily timestamps represent New York session dates, not intraday UTC bars. The existing normalizer excludes today's possibly incomplete daily bar. Historical endpoints can lag the most recent session; cache fetch time is not the observation date. A >7-day-old endpoint is visibly warned. Retained data after a provider failure is explicitly marked and can still support dated historical calculations.

- Price return: `100 × (last close / first close − 1)`, no dividends.
- Annualized volatility: sample standard deviation of daily log returns × √252 × 100; minimum 20 valid returns. 252 is a convention, not a forecast.
- Observed maximum drawdown: minimum of `close / running peak − 1`, in percent. This uses available daily closes, not intraday extremes; missing data can hide a worse drawdown.
- Range: lowest/highest observed daily close, not OHLC extremes or a guaranteed 52-week range. Range position: `(last − low)/(high − low)`; flat ranges are undefined.
- Positive sessions: proportion of valid log returns >0; minimum 20 returns. Best/worst session: simple returns, at least 2 return intervals.
- Correlation: Pearson correlation of paired consecutive daily log returns, at least 20 common return intervals; constant series are undefined. This is not correlation of price levels or evidence of cointegration.

Daily return intervals are counted only between consecutive scheduled regular sessions, including weekends/known holidays. Missing sessions are excluded, never bridged as one daily return. Unknown calendar years do not produce daily return intervals. Current calendar supports 2026–2027; historical endpoint/range statistics remain descriptive outside that calendar. Duplicate timestamps and invalid/future/nonpositive prices are excluded. Normalized comparison starts both at 100 on their first shared date and never connects unknown/missing sessions. Correlation is not a buy/sell recommendation; no mean-reversion assumption is made.

Splits can mechanically distort the unadjusted price history and all derived metrics. Dividends and total shareholder return are not included. This policy is deliberately consistent with existing demo indices; no legacy position is revalued by opening Analytics.

## Company size

Finnhub `/stock/profile2`, existing server-only `FINNHUB_API_KEY`. `marketCapitalization` and `shareOutstanding` are reported in millions and converted to units; validate catalog ticker, USD currency, finite positive capitalization. Invalid/unsupported symbols are not remapped to another security. Fetch time is displayed, but this endpoint supplies no valuation timestamp: do not call this a live synchronized market-cap snapshot.

Profiles use the same News storage namespace, distributed lease, UTC minute/day journal, error backoff and configured `NEWS_API_*_BUDGET` as news. Defaults: 10/minute, 500/day total across news and profiles. Selected companies and sectors have priority. Initial discovery is spread across sectors. Each batch attempts up to 3 profiles; at the default 10/minute shared budget, profiles use at most 8/minute and reserve 2 for news. Successful values are cached 24 hours. An adaptive poll follows server retry times, does not fetch while hidden, and never bypasses persisted minute/day limits. Fresh full-catalog coverage takes several minutes if quota and entitlements allow it. Filtered progress distinguishes fresh, dated, failed and pending profiles. A local bounded warmup is available via `node scripts/warm-company-profiles.cjs`; it calls the same app API and stops on budget/access/storage blocks. Failures count against quota; old values remain dated. A 429 blocks both Finnhub uses; no key means an explicit disconnected state.

Treemap area is proportional to available positive reported capitalization. Color represents the static catalog sector, never a fabricated daily return. Total capitalization is the sum of loaded filtered companies only; snapshots may have different retrieval times. The map is not the whole US market, an index weighting recommendation or trading volume. Table, search, sector filtering, keyboard selection and inspection are available. Missing capitalizations are excluded from areas but remain visible as unavailable in the table.

## News attention

Uses existing Finnhub company-news coverage only; no social API, sentiment model or global mentions claim. Unique publisher URLs in the loaded last 24 hours or 7 days are counted once per company. Source-provided related symbols and explicit headline/summary mentions use the same rules as Related Stocks. A story can count toward several companies; stories about one event at different URLs remain distinct. “Publishers” counts unique loaded source names. No loaded story does not mean a company has no coverage. Rolling catalog coverage, source status and dated caches are shown. Provider display/redistribution rights apply to company data and news as well as prices.

## Isolation and deployment

The research selection is separate from Trade. Only “Open this pair in Trade” explicitly selects that pair; no position, fee, account balance or liquidation formula is changed by Analytics. Existing browser-local demo storage remains unchanged. Uses Vercel's existing Redis configuration, with no additional cloud account or service purchase. No new secret is exposed to the client. See official [Twelve Data documentation](https://twelvedata.com/docs) and [Finnhub company profiles](https://finnhub.io/docs/api/company-profile2).
