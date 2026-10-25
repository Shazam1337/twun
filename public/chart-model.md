# TWUN interactive ratio charts

## Pair intelligence and comparison

Ratio remains the trading index. Components is a read-only view of actual underlying
close prices, supplied alongside each matched ratio observation. Both series start at
100 at the SAME first common timestamp of the selected available window. Missing
observations stay null. Prices are not reconstructed from the ratio. Old responses
without component closes display an honest unavailable state. Candles and position
levels are ratio-only; changing the view never changes margin, PnL or liquidation.

My trades markers use the event's real indexTime (never its simulated funding clock),
and only events for the exact oriented pair. They distinguish Open / Close / Liquidation.
News events are opt-in, use publisher timestamps and company associations, deduplicate
publisher URLs, and show a separate event list with source links. Markers group into
existing observed price buckets only; no after-hours bars, new price points or causal
claims are generated. Events beyond the last completed bar are not yet plotted.

The collapsible 2x2 comparison grid uses a common requested lookback with actual
coverage shown per tile. Tiles are read-only ratio LINE previews; they do not adopt
indices into the demo account. Only explicit Trade this pair changes the main market.
The active tile and order form show its oriented pair. User-created pairs and presets
are available in tile selectors, with layout saved to twun-comparison-v1. Other tiles
check the shared server cache every 60s on demand, request 15m intraday history refresh,
reuse shared symbol caches, and obey the SAME global provider quota. Closing the grid
stops its requests. Four charts are not a promise of four simultaneously fresh feeds
on a Basic budget; restriction/error/empty states stay visible independently.

The solid BLUE Current index line and its timestamp use the exact accepted quote
snapshot displayed in the terminal header. The dashed GRAY Candle close / History
close line uses the last displayed completed historical observation, with its own
timestamp above the chart. They intentionally can differ. For sampled candles the
time is the bucket END (not its start); intraday Line closes use source bar end.
Daily Line values show the exchange session date, not an invented intraday close time.
Quote updates never mutate completed candle OHLC. An unavailable quote removes the
current-index line and shows Quote unavailable; historical closes can remain visible.

Presentation: one toolbar separates candle resolution from lookback. Indicators,
refresh settings and extended methodology live in Chart settings. Dashed session
dividers mark each New York trading day. Session dates and gap percentages in candle tooltips compare
the previous DISPLAYED candle close with the next session's first DISPLAYED sample;
they are sampled-data gaps, not official stock opening/closing returns. Session
labels follow chart zoom, pan and resize. No candle spans a closed session and no
missing overnight path is painted as a candle body or wick.

Lightweight Charts provides pan, wheel/pinch zoom, normal crosshair, OHLC readout,
fit-content reset, expanded view, SMA20/EMA50 toggles and selected-pair entry/liquidation
levels. These chart controls never submit, sign, open, close or revalue a position.
Liquidation lines use the existing demo maintenance-margin formula; they are estimates.

## Candle semantics — read before interpreting wicks

Ratio R(t) = close(A,t)/close(B,t), using only matched completed 1-minute observations.
15m, 1h and session-day candles aggregate this OBSERVED ratio path: first sample is
open, maximum is high, minimum is low, final sample is close. These are sampled ratio
candles, NOT continuous tick-level OHLC, and the first sample is a 1m close, NOT the
actual stock opening price. No high(A)/high(B), low(A)/low(B), previous-close invented
opens, random points, interpolation or forward fills are used.

Buckets anchor at 09:30 America/New_York (DST-aware). The last hourly bucket ends
at the scheduled close and may be 30 minutes. Early closes follow our session calendar.
Every expected 1m slot must have a valid synchronized pair observation. Missing,
null, duplicate, unfinished or invalid observations suppress the bucket. Entirely
missing buckets remain absent; the time scale displays only available timestamps.
Fully completed, fully covered buckets only: there is NO fabricated developing candle.
The last completed candle can lag the current quote/index. PnL still uses quotes,
not candle closes. Weekends and overnight sessions are not invented.

## Period, resolution, refresh

The main chart has no 1D/7D/30D/90D/1Y lookback switch or ratio Line switch. Ratio uses
sampled candles with 15m/1h/1D bucket resolution; Components remains a two-line comparison.
Both start with the full latest matched 1m history (up to 5000 observations per stock),
not a client-clipped seven-day window. Initially about 45 candles are visible, with more
already loaded to the left. Panning toward the left boundary after user interaction
loads earlier real observations; an accessible Load earlier history button does the same.
Prepending preserves logical time anchors and zoom instead of jumping to the oldest page.
The header percentage is labelled Loaded history and uses first/last loaded ratio closes.

GET /api/history?base=...&quote=...&before=... validates a 1m UTC cursor. The server calls
/time_series with end_date=before-1m, outputsize=5000, timezone=UTC and adjust=none for
both stocks, then joins ONLY matching timestamps. Paging never requests quotes, changes
the trading index or adopts account marks. Reverse pairs reuse underlying page caches.
Shared Redis leases (or the single local provider queue) deduplicate pages and enforce
the existing global minute/day quota before each symbol request, including failed calls.
Pages have a 24h TTL and at most 64 cached symbol-pages. Latest histories are not pruned.
Every page normally costs two symbol credits. No empty space is filled with fake candles.
Validated empty provider responses stop paging; errors, ignored cursors, unavailable
access and quota exhaustion show a distinct message and preserve existing candles.
The client has a 50,000-observation memory boundary, explicitly labelled if reached.
Chart preferences use twun-chart-v2; indicators default off. Old preferences and demo accounts are retained.

History refresh selects 5/15/30/60 minutes for intraday stock histories. Server enforces
minimum 300 seconds, validates allowed values, uses shared symbol caches and quota
accounting. Another viewer can refresh the shared cache sooner than a slower setting;
the setting is a request cadence, not a private cache or guaranteed freshness SLA.
Daily history remains cached for 6h regardless of this intraday setting.
Existing error/backoff windows are honored. Manual refresh never bypasses quota.
Browser cache checks stay at 15s; quote provider minimum stays 120s and position
valuation/liquidation stays independent of chart refresh. No second/tick mode is offered.
Old successful 30m cache entries become eligible according to checkedAt + new cadence.
One continuously viewed pair needs about 156 intraday-history symbol credits per full
session at 5m refresh, plus about 390 quote credits, daily history and retries. Other
positions/users/symbols share the same budget and may exhaust it; no plan is purchased.

SMA20 and EMA50 use visible-source closes (candle closes in Candles mode); EMA seeds
from an initial SMA. No output before warm-up. These are indicators, not price forecasts.
Unmatched explicit observations reset warm-up. Position levels are displayed only for
the exact oriented pair. Reversal recomputes candles from inverse matched ratios,
not by incorrectly inverting the old high/low fields in place.

Unadjusted split policy remains unchanged; corporate actions can cause discontinuities.
True sub-minute ratio candles require licensed synchronized finer-resolution or tick
data and a separately specified sampling/oracle policy; installing a chart does not
provide those market data rights or transport.

## Optional connected display (default enabled)

Connected candles is a clearly labelled PRESENTATION transform, not observed OHLC.
For adjacent complete buckets within the same New York session only, drawn Open is
the previous observed Close; drawn High=max(observed High, drawn Open) and drawn
Low=min(observed Low, drawn Open). Close, time and sample count remain unchanged.
This may change body direction and extend the displayed range. It is an intentionally
synthetic visual convention, not evidence of an observed opening or traded extreme.
Missing buckets, overnight/session boundaries and daily candles are never joined.
No minimum wick/body is invented and no interpolation or additional bars are added.

The visible Connected candles button toggles back to Observed candles and saves only
the chart preference. The toolbar notice identifies visual adjustment. Tooltip OHLC
and the inline readout always show ORIGINAL sampled values; tooltip separately lists
the drawn open and warns that the drawn range includes it. Current index, history
return, indicators (close-based), ruler, news, demo positions, fees, funding and
liquidation all retain their original sources/formulas. The server cache/API and
stored demo accounts never receive transformed candles. Earlier references to no
previous-close invented opens describe the observed data model, not this display mode.

## Inspection and measurement

Default view shows about 45 candles; zoom and historical paging remain available.
Ratio axis labels use four decimals (six for very small ratios); the candle tooltip
shows eight-decimal sampled OHLC, the actual bucket start/end in UTC, open-to-close
change, sample count and New York session context. Session dates/gaps are tooltip
details, not permanent labels over candles. Grid lines are subdued.
If quote and completed close round to the same displayed axis price, one blue
Index / close axis label is shown. The underlying values and their separate
timestamps remain available above the plot; rounding never affects account marks.
Only the selected position has entry/estimated-liquidation lines. The position
caption uses existing account marks for gross unrealized PnL, before fees/funding.
Unavailable feed captions identify the last accepted account mark.

The Ruler toolbar button enables a read-only drag overlay. Endpoints snap to actual
completed candle CLOSES, never invented prices or wicks. Change = (end/start - 1)*100;
elapsed time is absolute wall-clock time, including closures, and candle count is
inclusive. Reverse dragging gives the directed reverse return. This is not leveraged
PnL. Enter/Space anchors endpoints, arrows move the second endpoint, Escape clears.
Disable Ruler to resume normal pan/zoom. Changing pair, resolution, view or prepending
an older page clears the measurement. No API call, order or signature is generated.

## Attribution

TradingView Lightweight Charts™
Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
Library license: Apache-2.0. The chart retains the attribution logo and creator link.
