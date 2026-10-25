# Stock tape refresh

`GET /api/ticker` now performs demand-driven catalog rotation through the SAME
UniverseProvider queue / Redis lease, symbol cache, quota journal and provider backoff
as the terminal. Browsers check every 30 seconds; extra viewers cannot multiply
upstream calls. No background scheduler or 50-symbol call per viewer is introduced.

At most ONE upstream HTTP request per UTC minute, with up to TWO symbol credits:
oldest checked eligible quotes first, same-exchange batch. Success is eligible after
one hour during the main session; failures honor existing nextAt/backoff. After all
eligible quote checks, one oldest 5min stock history is refreshed per minute for the
24h reference, reusing existing cache. History eligibility is six hours; requested
histories use the existing adjustment/timezone policy and provider limits.

`TWELVE_DATA_TICKER_DAILY_BUDGET` defaults to 180, INCLUDED in (not added to) the global
750-credit daily allowance. Set 0 to disable catalog upstream refresh. Attempts are
charged to both the ticker allowance and global journal BEFORE dispatch and remain
charged on provider errors, restarts, and independent serverless instances. The
minute limiter leaves four of eight credits for trading; the daily limiter additionally
leaves 40 of 750 credits untouched. Multiple positions/history pages still share the
same finite provider budget; this is not a guarantee of unlimited fresh markets.

One first quote sweep usually requires about 25–30 minutes while the site is actively
viewed, longer under quota, provider errors or exchange grouping. 24h history fills
later. 180 credits/day does NOT support continuously fresh 50-stock quotes: most
symbols are periodic dated snapshots. Busy leases serve committed cache only.
No calls occur without demand. No tariff is upgraded or purchased.

While the market is open, quotes older than five minutes or provider-closed flags
are marked stale. Their positive valid prices remain explicitly dated, but change24h
and referenceTime are null. Error-status quotes also never display a current change.
When closed, only quotes within five minutes of the latest scheduled session close
can retain a percentage, labelled 24h AT QUOTE, not 24 hours from the current clock.
The scheduled close uses the existing America/New_York holiday/early-close calendar.
Older sessions stay stale. Already current last-session quotes are not repolled just
because the market remains closed. No previous-session or daily-return fallback,
interpolation, fabricated data, or replacement timestamps are used.

The footer reports fresh/last-session coverage and rotation quota/backoff status.
Updating ticker cache does not itself alter demo positions. Trading state continues
to adopt only accepted, validated and synchronized pair snapshots via its existing
market feed. Pair selection, chart resolution, fees and account persistence are unchanged.
