# TWUN on Vercel

The Next.js app runs on Vercel Node.js Functions. Twelve Data supplies the stock prices;
Upstash Redis supplies a shared durable cache, refresh lock and API quota journal.
Upstash is a storage API, not a replacement stock-price provider.

## Connect services

1. In Vercel, open the TWUN project → Storage / Marketplace → Upstash Redis.
   Connect an existing database or create one in your account. Choose a region close
   to the Vercel Functions. Use a persistent database with eviction disabled for the
   quota journal; do not use an expiring trial database for production.
2. Add the following **server-only** environment variables to Production:

   ```dotenv
   TWELVE_DATA_API_KEY=your-provider-key
   UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-write-token
   MARKET_REDIS_NAMESPACE=twun-market-v1
   TWELVE_DATA_DAILY_BUDGET=750
   TWELVE_DATA_MINUTE_BUDGET=8
   TWELVE_DATA_QUOTE_SECONDS=120
   ```

   The Marketplace can populate the Upstash variables. Older integrations using
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also supported. A readonly token is
   insufficient: quota must be reserved before any provider request.
3. Redeploy after setting variables. All keys and tokens stay on the server; never
   prefix them with `NEXT_PUBLIC_`, commit `.env.local`, or send secrets in screenshots.
4. Open `/api/market?base=NVDA&quote=TSLA&interval=1day` and `/trade`.
   A configured source should return real data or an explicit provider status, such
   as access denied or quota exhausted. Missing provider key reports `not_configured`;
   missing Redis credentials report a shared-storage configuration error. Storage
   outages pause the feed; there is no fallback to per-instance quotas or fake prices.

Use one dedicated Twelve Data key for this service. Production, previews and any
other instances that use that key MUST share the same Redis database and namespace.
For an untrusted preview, omit the provider key or use separate credentials. Do not
run a local filesystem-backed feed with the production key concurrently: it has a
different quota journal. For a key already used today, reduce the new deployment's
daily budget to the remaining allocation, or start it after the provider's UTC day
reset. Existing local usage is not automatically imported into Redis.

## Serverless behavior

- The complete symbol cache and quota journal are stored as one versioned Redis
  value, without expiration. One Redis Lua lease serializes refreshes across
  instances. State and lock keys share a hash tag.
- Each refresh owner loads the journal atomically when acquiring its lease. Before
  each upstream request, it awaits a token-checked Redis commit of the consumed
  credits. A stopped function therefore leaves a conservative charged attempt.
- Other instances immediately serve committed cached values. Existing age/skew
  validation prevents stale open-session prices from enabling demo trading.
- Lease duration is 90 seconds and commits renew it. An expired owner's saves and
  release cannot overwrite or unlock a newer owner. The refresh has a 25-second
  upstream time budget; `/api/market` sets `maxDuration = 60`. Redis requests time
  out after 4 seconds. There are no background refresh tasks after a response.
- `/api/catalog` and `/api/ticker` only read shared committed data. Public catalog
  verification (`?verify=`) is disabled on Vercel so it cannot consume credits.
- Quotes retain the 120-second minimum refresh, histories retain their separate
  TTLs, and 429 backoff and daily/minute budgets are shared. No cron is required.
- Prices, ratio formulas, trading-session rules, simulated funding/liquidation,
  wallet connection and local browser portfolio storage are unchanged.

Never delete the Redis namespace to reset API limits. Keep backups; if the journal
is malformed the app stops requests rather than silently resetting counters. Redis
service loss/eviction or use of the provider key outside this service cannot be
recovered from the journal alone. Provider display/redistribution rights still apply.

## Local development

Without Redis credentials and outside Vercel, the existing single-Node filesystem
cache remains at `.cache/pair-twelve-data-v1.json`. To reproduce serverless behavior
locally, configure a development Redis database and separate provider credentials.

The code/tests use deterministic provider/Redis fixtures. A successful local build
does not prove access to your actual Upstash database. After connecting services,
verify the real deployment without disclosing its credentials.

Official references: [Vercel Redis](https://vercel.com/docs/redis),
[Vercel environment variables](https://vercel.com/docs/environment-variables),
[Upstash integration](https://upstash.com/docs/redis/howto/vercelintegration),
[Upstash REST API](https://upstash.com/docs/redis/features/restapi).
