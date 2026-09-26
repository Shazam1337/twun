/** Server adapter; imported only by the server composition root and unit tests. */
import { demoIndexAllowed, feedMessages, FeedStatus, History, indexFresh, IndexSnapshot, MarketFeed } from "./market";
import { marketSession } from "./market-calendar";
import { FeedError, normalizeHistory, normalizeQuotes, providerError } from "./twelve-normalize";

export type ProviderDisk = {
  day: string; used: number; minute: number; minuteUsed: number; blockedUntil: number; failures: number;
  quoteNext: number; closedRefresh: string; snapshot: IndexSnapshot | null; quoteStatus: FeedStatus;
  histories: MarketFeed["histories"]; historyNext: Record<"5min" | "1day", number>;
};
export const emptyProviderDisk = (): ProviderDisk => ({ day: "", used: 0, minute: 0, minuteUsed: 0, blockedUntil: 0, failures: 0, quoteNext: 0, closedRefresh: "", snapshot: null, quoteStatus: "unavailable", histories: { "5min": null, "1day": null }, historyNext: { "5min": 0, "1day": 0 } });
type Options = { key: string; now?: () => number; fetcher?: typeof fetch; disk?: ProviderDisk; persist?: (s: ProviderDisk) => void; dayBudget?: number; minuteBudget?: number; quoteMs?: number; timeoutMs?: number };

export class TwelveProvider {
  private disk: ProviderDisk;
  private flight: Promise<MarketFeed> | null = null;
  private now: () => number;
  private fetcher: typeof fetch;
  private fatal = false;
  constructor(private options: Options) { this.disk = options.disk ?? emptyProviderDisk(); this.now = options.now ?? Date.now; this.fetcher = options.fetcher ?? fetch; }
  private save() { try { this.options.persist?.(this.disk); } catch { this.fatal = true; throw new FeedError("unavailable"); } }
  private reserve(cost = 2) {
    if (this.fatal) throw new FeedError("unavailable");
    const now = this.now(), day = new Date(now).toISOString().slice(0, 10), minute = Math.floor(now / 60_000);
    if (day !== this.disk.day) { this.disk.day = day; this.disk.used = 0; }
    if (minute !== this.disk.minute) { this.disk.minute = minute; this.disk.minuteUsed = 0; }
    const dailyLimit = this.options.dayBudget ?? 750, minuteLimit = this.options.minuteBudget ?? 8;
    if (this.disk.used + cost > dailyLimit) {
      this.disk.blockedUntil = Date.parse(`${day}T00:00:00Z`) + 86400000; this.save(); throw new FeedError("quota_exhausted");
    }
    if (this.disk.minuteUsed + cost > minuteLimit) { this.disk.blockedUntil = (minute + 1) * 60_000; this.save(); throw new FeedError("quota_exhausted"); }
    if (now < this.disk.blockedUntil) throw new FeedError("quota_exhausted");
    // One credit per symbol. Persist BEFORE dispatch, including failed attempts/retries.
    this.disk.used += cost; this.disk.minuteUsed += cost; this.save();
  }
  private async request(endpoint: "quote" | "time_series" | "logo", params: Record<string, string>, symbols = ["NVDA", "TSLA"]) {
    this.reserve(symbols.length);
    const url = new URL(`https://api.twelvedata.com/${endpoint}`);
    for (const [k, v] of Object.entries({ symbol: symbols.join(","), exchange: "NASDAQ", country: "United States", timezone: "UTC", prepost: "false", format: "JSON", ...params })) url.searchParams.set(k, v);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await this.fetcher(url, { headers: { Authorization: `apikey ${this.options.key}` }, signal: controller.signal, cache: "no-store", redirect: "error" });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - this.now())) : 0;
        throw new FeedError("quota_exhausted", Number.isFinite(retryMs) ? retryMs : 0);
      }
      if ([401, 403].includes(response.status)) throw new FeedError("access_denied");
      if (!response.ok) throw new FeedError("unavailable");
      const raw: unknown = await response.json();
      providerError(raw); // Errors also arrive as HTTP 200. Never forward upstream messages.
      return raw;
    } catch (error) {
      if (error instanceof FeedError) throw error;
      throw new FeedError("unavailable");
    } finally { clearTimeout(timeout); }
  }
  async requestSymbols(endpoint: "quote" | "time_series" | "logo", symbols: string[], params: Record<string, string>) {
    try { return await this.request(endpoint, params, symbols); }
    catch (error) { const status = this.failure(error); this.save(); throw new FeedError(status); }
  }
  recordQuotaFailure(error: unknown) { this.failure(error); this.save(); }
  budget() { return { used: this.disk.used, limit: this.options.dayBudget ?? 750, minuteUsed: this.disk.minute === Math.floor(this.now()/60000) ? this.disk.minuteUsed : 0, minuteLimit: this.options.minuteBudget ?? 8, retryAt: this.disk.blockedUntil, day: this.disk.day }; }
  private failure(error: unknown) {
    const failure = error instanceof FeedError ? error : new FeedError("partial");
    if (failure.status === "quota_exhausted") {
      this.disk.failures++;
      this.disk.blockedUntil = Math.max(this.disk.blockedUntil, this.now() + Math.max(failure.retryMs, Math.min(15 * 60_000, 60_000 * 2 ** Math.min(this.disk.failures - 1, 4))));
    } else if (failure.status === "access_denied") this.disk.blockedUntil = this.now() + 10 * 60_000;
    return failure.status;
  }
  async get(): Promise<MarketFeed> {
    if (this.flight) return this.flight;
    this.flight = this.refresh().finally(() => { this.flight = null; });
    return this.flight;
  }
  private output(): MarketFeed {
    const now = this.now(), session = marketSession(now);
    let status = this.options.key ? this.disk.quoteStatus : "not_configured" as FeedStatus;
    const snapshot = this.options.key ? this.disk.snapshot : null;
    if (status === "ready" && snapshot && session.state === "open" && !indexFresh(snapshot, now)) status = "stale";
    const canTrade = status === "ready" && demoIndexAllowed(snapshot, session, now);
    return { status, message: feedMessages[status], snapshot, session, histories: this.options.key ? this.disk.histories : { "5min": null, "1day": null }, serverTime: now, retryAt: Math.max(this.disk.quoteNext, this.disk.blockedUntil), canTrade };
  }
  private async refresh(): Promise<MarketFeed> {
    if (!this.options.key) return this.output();
    if (this.fatal) { this.disk.quoteStatus = "unavailable"; return this.output(); }
    const now = this.now(), session = marketSession(now);
    // One post-close refresh per ET date (also on cold start), not all-night REST polling.
    const closedKey = `${session.date}:${now >= session.closesAt ? "after" : "before"}`;
    const quoteDue = now >= this.disk.quoteNext && (session.state === "open" || this.disk.closedRefresh !== closedKey);
    if (now < this.disk.blockedUntil || session.state === "unknown") return this.output();
    if (quoteDue) {
      this.disk.quoteNext = now + Math.max(120_000, this.options.quoteMs ?? 120_000);
      try {
        const raw = await this.request("quote", { interval: "1min", eod: "false" });
        const next = normalizeQuotes(raw, this.now());
        // Entire validated pair replaces cache atomically; never merge individual symbols.
        if (session.state === "open" && !indexFresh(next, this.now())) {
          this.disk.quoteStatus = "stale";
        } else {
          this.disk.snapshot = next; this.disk.quoteStatus = "ready"; this.disk.failures = 0;
          if (session.state !== "open") this.disk.closedRefresh = closedKey;
        }
      } catch (error) { this.disk.quoteStatus = this.failure(error); }
      try { this.save(); } catch { this.disk.quoteStatus = "unavailable"; }
    }
    // Quotes take priority. A failed pair stops historical work as well.
    if (this.disk.quoteStatus !== "ready") return this.output();
    for (const interval of ["5min", "1day"] as const) {
      if (this.now() < this.disk.blockedUntil || now < this.disk.historyNext[interval]) continue;
      const previous = this.disk.histories[interval];
      // Off-session: once per closure/date, alongside the closing quote. No user-specific ranges upstream.
      if (session.state !== "open" && previous && previous.fetchedAt >= (this.disk.snapshot?.fetchedAt ?? 0)) continue;
      const ttl = interval === "5min" ? 30 * 60_000 : 6 * 60 * 60_000;
      this.disk.historyNext[interval] = now + ttl;
      try {
        const raw = await this.request("time_series", { interval, outputsize: interval === "5min" ? "1000" : "400", adjust: "none", order: "asc" });
        this.disk.histories[interval] = normalizeHistory(raw, interval, this.now());
      } catch (error) {
        const status = this.failure(error);
        this.disk.histories[interval] = previous ? { ...previous, status } : { interval, points: [], fetchedAt: 0, unmatched: 0, status } satisfies History;
        this.disk.historyNext[interval] = this.now() + 120_000;
      }
      try { this.save(); } catch { this.disk.quoteStatus = "unavailable"; }
    }
    return this.output();
  }
}
