# News in TWUN

`/news` shows aggregated company coverage and company-specific stories from the 50-stock
catalog. The terminal shows separate feeds for the selected pair's two stocks.
This is publisher news, not user reviews or generated analyst opinions.

Newsroom filters combine headline/company search, company coverage, publisher,
publication period (24 hours / 7 days / any available time), and “Has related stocks”.
The latter uses the same validated company associations as the logos below each story,
including explicit text mentions. Filters operate on the entire loaded feed,
not the provider's full archive, and make no additional API requests. All valid,
deduplicated stories returned by the provider within the seven-day window are retained;
there is no 40-story truncation. Newsroom renders 20 stories initially and Load more
reveals the next 20 locally, without provider calls. Changing filters or company resets
the visible page size; filtering happens before pagination. Feed availability still
depends on the upstream response. Previously truncated cached feeds expand on their
next scheduled successful refresh, without bypassing cache or quota limits.
The visible count shows matching versus loaded stories. A compact Filters button
opens the advanced controls (collapsed initially) and shows an active-filter count.
Collapsing keeps filters applied; Escape closes the panel and restores button focus.
Clear filters resets search, company coverage, publisher, time and related-stock filters.

The server adapter uses Finnhub `/company-news` with
`symbol`, `from`, `to` (the past seven days). It sends `X-Finnhub-Token` in a server
header. No provider key, raw error or full article is sent to the browser. Links open
the publisher's original article; headlines carry source and publication time in UTC.
Summaries are short provider excerpts, not an AI-generated market assessment.

Market overview now merges cached company-news feeds from the stock catalog, not the
general geopolitical news endpoint. Duplicate normalized publisher URLs are collapsed
and their catalog stock associations are unioned. The old general `market` cache is
left untouched but excluded. Existing company caches are reused immediately, including
terminal requests. Articles older than seven days are excluded during aggregation.

On a Market overview request, a shared persistent reservation allows at most TWO
eligible company refreshes per 60 seconds across all users/instances. Companies are
visited oldest-attempt-first (unchecked first), so an unavailable company cannot starve
the rest. Each catalog company refreshes at most every SIX HOURS (configurable upward)
on this aggregate path; direct company views keep their normal ten-minute cache.
An empty catalog therefore takes about 25 minutes of active polling to fill all 50
feeds at the default rate, subject to quotas, errors and upstream availability. There
is no background timer or guaranteed update when nobody visits the site. Coverage
checked/50 is shown explicitly; it means successful feed requests, NOT 50 fresh stories
or a promise that all companies have published news. Every article retains its time.
Provider retries, terminal company views and aggregate batches all consume the SAME
global minute/day budget. A full successful six-hour rotation is about 200 requests
per 24 hours of continuous use; additional direct views and failures may reach the
500/day allocation. Budget exhaustion pauses fetching rather than inventing stories.

Every article has a related-stocks row: up to five company logos plus an ellipsis
for additional companies. Clicking any related company opens Trade's Create pair
selector with that company as the first stock and the second stock empty. The user
must choose a different second stock and confirm; cancelling leaves the active market
and positions unchanged. Source ticker tags are combined
with explicit catalog company names/tickers found in the headline and short summary;
tooltips distinguish source associations from text mentions. This does not infer price
impact, sentiment or trading signals. General stories without an identified company are
marked accordingly. Existing cached stories are matched without extra provider calls.

Set `FINNHUB_API_KEY` in `.env.local` locally and in Vercel Production environment
variables. Restart locally or redeploy on Vercel. Without a key, the feed explicitly
shows not connected, without placeholder stories. No authenticated Finnhub response
has been verified until a real key is configured.

Vercel uses the same Upstash REST credentials as prices, with a DIFFERENT namespace:

```dotenv
FINNHUB_API_KEY=
NEWS_REDIS_NAMESPACE=twun-news-v1
NEWS_REFRESH_SECONDS=600
NEWS_CATALOG_REFRESH_SECONDS=21600
NEWS_API_MINUTE_BUDGET=10
NEWS_API_DAILY_BUDGET=500
```

The application budgets above are conservative allocation limits, not a claim about
your plan. Adjust to actual Finnhub entitlements and other uses of that API key.
Every dispatched call, including failures, is charged before network access. All
instances using one news key must share its news namespace. Do not use the same
namespace as Twelve Data's price/quota journal. Locally, without Redis, a single Node
process uses `.cache/twun-news-v1.json`; do not run a separate local journal with the
production provider key concurrently.

Direct company feeds refresh on demand every 10 minutes (configurable, at least 5 minutes), with
60-second browser cache checks. Scope-specific cached entries deduplicate requests;
Redis leases share ownership and minute/day budgets across Vercel Functions. No
burst polling of every company occurs. Catalog aggregation uses the bounded rolling
policy above. Company failure does not replace another feed.
429 cooldown honors Retry-After and exponential backoff; access denial waits 10
minutes. Provider timeouts are 8 seconds. Redis failure pauses news requests while
prices/trading continue independently. Old headlines stay dated and marked cached.

Malformed, unsafe, future and out-of-window items are rejected. URLs are HTTPS and
deduplicated with tracking parameters removed. No full article scraping or invented
headlines, summaries, sentiment or ratings. Public news display depends on Finnhub
and publisher entitlements; confirm them for your use before public distribution.

References: [Market news](https://finnhub.io/docs/api/market-news),
[Company news](https://finnhub.io/docs/api/company-news),
[Official SDK authentication](https://github.com/Finnhub-Stock-API/finnhub-go),
[Commercial access](https://finnhub.io/pricing-startups-and-enterprise).
