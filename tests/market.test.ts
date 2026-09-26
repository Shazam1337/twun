import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHistory, normalizeQuotes } from "../lib/twelve-normalize";
import { marketSession, nyTime } from "../lib/market-calendar";
import { historyChange, indexFresh, MarketFeed, SOURCE, tradeAllowed } from "../lib/market";
import { emptyProviderDisk, TwelveProvider } from "../lib/twelve-provider";
import { adoptIndex, initialLiveAccount, isLiveAccount } from "../lib/live-account";
import { initialPerpsState, openPosition, pnl } from "../lib/perps";

// Test fixtures only. Never imported by the app or used as fallback market prices.
const at = Date.UTC(2026, 8, 24, 16);
function quotes(now = at, ratio = .5) {
  return Object.fromEntries((["NVDA", "TSLA"] as const).map(symbol => [symbol, { symbol, exchange: "NASDAQ", currency: "USD", close: String(symbol === "NVDA" ? ratio * 200 : 200), last_quote_at: now / 1000, timestamp: now / 1000 - 86400, is_market_open: true }]));
}
function series(interval = "5min") {
  return Object.fromEntries(["NVDA", "TSLA"].map(symbol => [symbol, { status: "ok", meta: { symbol, interval, exchange: "NASDAQ", currency: "USD", exchange_timezone: "America/New_York" }, values: [
    { datetime: interval === "5min" ? "2026-09-24 15:00:00" : "2026-09-22", close: symbol === "NVDA" ? "100" : "200", high: "999999", low: "0" },
    { datetime: interval === "5min" ? "2026-09-24 15:05:00" : "2026-09-23", close: symbol === "NVDA" ? "110" : "200", high: "999999", low: "0" },
  ] }]));
}
function feed(now = at, ratio = .5): MarketFeed { return { status: "ready", message: "fixture", snapshot: normalizeQuotes(quotes(now, ratio), now), session: marketSession(now), serverTime: now, canTrade: true, histories: { "5min": null, "1day": null }, retryAt: now + 120000 }; }
test("quote ratio uses positive USD closes and last_quote_at, never bar timestamp", () => {
  const q = normalizeQuotes(quotes(), at); assert.equal(q.ratio, .5); assert.equal(q.timestamp, at); assert.ok(indexFresh(q, at));
  for (const change of [{ symbol: "AAPL" }, { currency: "EUR" }, { close: "NaN" }, { close: "Infinity" }, { close: "0" }, { last_quote_at: undefined }, { last_quote_at: at / 1000 + 20 }]) {
    const raw = quotes(); Object.assign(raw.NVDA, change); assert.throws(() => normalizeQuotes(raw, at));
  }
  const raw = quotes(); raw.TSLA.last_quote_at -= 61; assert.throws(() => normalizeQuotes(raw, at), /desynchronized/);
  const partial = { ...quotes(), TSLA: { status: "error", code: 404 } }; assert.throws(() => normalizeQuotes(partial, at), /partial/);
});
test("history inner-joins matching completed closes, leaves missing observations null, ignores highs/lows", () => {
  const h = normalizeHistory(series(), "5min", at); assert.deepEqual(h.points.map(p => p.value), [.5, .55]);
  assert.ok(Math.abs(historyChange(h.points)! - 10) < 1e-8);
  const raw = series(); raw.NVDA.values.push({ datetime: "2026-09-24 15:10:00", close: "120", high: "999", low: "0" });
  const gap = normalizeHistory(raw, "5min", at); assert.equal(gap.unmatched, 1); assert.equal(gap.points.at(-1)!.value, null);
  raw.TSLA.meta.interval = "1min"; assert.throws(() => normalizeHistory(raw, "5min", at));
  const daily = normalizeHistory(series("1day"), "1day", at); assert.equal(daily.points[0].timestamp, Date.UTC(2026, 8, 22, 4));
  assert.equal(nyTime("2026-01-15", 0), Date.UTC(2026, 0, 15, 5));
});
test("session observes ET, Good Friday, holiday observances, early closes and unknown-year fail-closed", () => {
  assert.equal(marketSession(at).state, "open");
  for (const day of ["2026-04-03", "2026-07-03", "2026-11-26", "2026-12-25", "2027-06-18"]) assert.equal(marketSession(nyTime(day, 12)).state, "closed");
  for (const day of ["2026-11-27", "2026-12-24"]) {
    assert.equal(marketSession(nyTime(day, 12, 59)).state, "open"); assert.equal(marketSession(nyTime(day, 13)).state, "closed");
  }
  assert.equal(marketSession(nyTime("2028-09-25", 12)).state, "unknown");
});
test("stale/closed/partial indexes freeze accounts; recovery is atomic; v2 never repriced", () => {
  let s = initialLiveAccount(at); assert.ok(isLiveAccount(s));
  const adopted = adoptIndex(s, feed(), at); assert.ok(adopted.ok); if (!adopted.ok) return; s = adopted.state;
  const opened = openPosition(s, "Long", 100, 5); assert.ok(opened.ok); if (!opened.ok) return;
  s = { ...opened.state, positions: opened.state.positions.map(p => ({ ...p, dataSource: SOURCE, entryIndexTime: at, entryIndexId: s.acceptedIndex!.id })) };
  assert.ok(isLiveAccount(s)); const before = JSON.stringify(s);
  for (const bad of [{ ...feed(at, .1), status: "partial" as const }, { ...feed(), session: marketSession(nyTime("2026-09-24", 16)) }, feed(at - 301000, .1)]) assert.equal(adoptIndex(s, bad, at).ok, false);
  assert.equal(JSON.stringify(s), before); assert.equal(tradeAllowed(feed(), at + 301000), false);
  assert.equal(adoptIndex(initialPerpsState(), feed(), at).ok, false); assert.equal(isLiveAccount(initialPerpsState()), false);
  const recovered = adoptIndex(s, feed(at + 120000, .55), at + 120000); assert.ok(recovered.ok);
  if (recovered.ok) assert.ok(Math.abs(pnl(recovered.state.positions[0], recovered.state.mark) - 50) < 1e-8);
  const breach = adoptIndex(s, feed(at + 120000, .4), at + 120000); assert.ok(breach.ok); if (breach.ok) assert.equal(breach.state.positions.length, 0);
});
test("shared cache deduplicates concurrent callers; each batch charges two, quotes refresh after 120s", async () => {
  let now = at, calls = 0;
  const disk = emptyProviderDisk();
  const p = new TwelveProvider({ key: "unit-test-only", now: () => now, disk, fetcher: async url => {
    calls++; const u = new URL(String(url));
    assert.equal(u.searchParams.has("apikey"), false);
    if (u.pathname === "/time_series") { assert.equal(u.searchParams.get("adjust"), "none"); return Response.json(series(u.searchParams.get("interval")!)); }
    return Response.json(quotes(now));
  } });
  const responses = await Promise.all(Array.from({ length: 20 }, () => p.get()));
  assert.equal(calls, 3); assert.equal(disk.used, 6); assert.ok(responses.every(r => r.canTrade));
  now += 119000; await p.get(); assert.equal(calls, 3);
  now += 1000; await p.get(); assert.equal(calls, 4); assert.equal(disk.used, 8);
});
test("429 backoff honors Retry-After and counts retry credits; one failed symbol cannot contaminate last pair", async () => {
  let now = at, mode = "ok", calls = 0;
  const disk = emptyProviderDisk();
  const p = new TwelveProvider({ key: "unit-test-only", now: () => now, disk, fetcher: async url => {
    calls++; const u = new URL(String(url));
    if (mode === "429") return new Response(null, { status: 429, headers: { "Retry-After": "180" } });
    if (u.pathname === "/time_series") return Response.json(series(u.searchParams.get("interval")!));
    if (mode === "partial") return Response.json({ NVDA: { ...quotes(now).NVDA, close: "1" }, TSLA: { status: "error", code: 500 } });
    return Response.json(quotes(now, .55));
  } });
  const initial = await p.get(); const id = initial.snapshot!.id;
  now += 120000; mode = "429"; assert.equal((await p.get()).status, "quota_exhausted"); assert.equal(disk.used, 8);
  now += 120000; await p.get(); assert.equal(calls, 4);
  now += 60000; mode = "partial"; const failed = await p.get(); assert.equal(failed.snapshot!.id, id); assert.equal(failed.canTrade, false); assert.equal(disk.used, 10);
  now += 120000; mode = "ok"; const restored = await p.get(); assert.equal(restored.canTrade, true); assert.notEqual(restored.snapshot!.id, id); assert.equal(restored.snapshot!.base.timestamp, restored.snapshot!.quote.timestamp);
});
test("budget includes histories and failed attempts, survives provider restart; absent key makes no calls", async () => {
  let now = at, calls = 0; const disk = emptyProviderDisk();
  const options = { key: "unit-test-only", now: () => now, disk, dayBudget: 6, fetcher: (async (url: URL | RequestInfo) => { calls++; const u = new URL(String(url)); return Response.json(u.pathname === "/quote" ? quotes(now) : series(u.searchParams.get("interval")!)); }) as typeof fetch };
  await new TwelveProvider(options).get(); assert.equal(calls, 3);
  now += 120000; const exhausted = await new TwelveProvider(options).get(); assert.equal(exhausted.status, "quota_exhausted"); assert.equal(calls, 3);
  assert.equal((await new TwelveProvider({ ...options, key: "" }).get()).status, "not_configured"); assert.equal(calls, 3);
});
test("HTTP200 permission errors, timeouts and closed session are explicit, without false valid quotes", async () => {
  for (const status of [401, 403]) {
    const p = new TwelveProvider({ key: "unit-test-only", now: () => at, fetcher: async () => Response.json({ status: "error", code: status, message: "NEVER FORWARD SECRET" }) });
    const r = await p.get(); assert.equal(r.status, "access_denied"); assert.ok(!JSON.stringify(r).includes("SECRET"));
  }
  const closed = nyTime("2026-11-27", 14);
  const p = new TwelveProvider({ key: "unit-test-only", now: () => closed, fetcher: async url => {
    const u = new URL(String(url)); const q = quotes(nyTime("2026-11-27", 12, 59)); q.NVDA.is_market_open = false; q.TSLA.is_market_open = false;
    return Response.json(u.pathname === "/quote" ? q : series(u.searchParams.get("interval")!));
  } });
  const result = await p.get(); assert.equal(result.canTrade, true); assert.equal(result.session.state, "closed"); assert.equal(result.snapshot!.ratio, .5);
  const timed = new TwelveProvider({ key: "unit-test-only", now: () => at, timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout")))) });
  assert.equal((await timed.get()).status, "unavailable");
});
