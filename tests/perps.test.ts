import test from "node:test";
import assert from "node:assert/strict";
import { advanceFunding, closePosition, equity, initialPerpsState, isPerpsState, liquidationRatio, openPosition, PerpsState, pnl, ratioSeries, Result, setMark, totals } from "../lib/perps";
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const ok = (r: Result): PerpsState => { if (!r.ok) throw new Error(r.error); assert.equal(r.ok, true); return r.state; };

test("100 margin × 5x: 0.50 to 0.55 yields Long +50 before costs; Short -50", () => {
  for (const side of ["Long", "Short"] as const) {
    const start = initialPerpsState();
    let s = ok(openPosition(start, side, 100, 5));
    assert.equal(start.positions.length, 0);
    near(s.freeUsdc, 9899.75);
    near(s.positions[0].notional, 500);
    s = ok(setMark(s, .55));
    near(pnl(s.positions[0], s.mark), side === "Long" ? 50 : -50);
    near(totals(s).equity, side === "Long" ? 10049.75 : 9949.75);
    s = ok(closePosition(s, s.positions[0].id));
    near(s.freeUsdc, side === "Long" ? 10049.5 : 9949.5);
    near(totals(s).fees, .5);
    near(totals(s).realized, side === "Long" ? 49.5 : -50.5);
    assert.equal(s.positions.length, 0);
    assert.equal(closePosition(s, s.history[0].positionId).ok, false);
  }
});

test("Short profits from a fall; fees and signed funding settle separately exactly once", () => {
  let s = ok(openPosition(initialPerpsState(), "Short", 100, 5));
  s = ok(setMark(s, .45));
  near(pnl(s.positions[0], s.mark), 50);
  const free = s.freeUsdc;
  s = ok(advanceFunding(s));
  near(s.positions[0].funding, -.05);
  near(s.freeUsdc, free);
  const restored = JSON.parse(JSON.stringify(s));
  assert.ok(isPerpsState(restored));
  near(restored.positions[0].funding, -.05);
  s = ok(closePosition(restored, restored.positions[0].id));
  near(s.freeUsdc, 10049.55);
  near(totals(s).funding, -.05);
  near(totals(s).realized, 49.55);
});

test("Long +50 less entry/exit fees and one funding interval = +49.45", () => {
  let s = ok(openPosition(initialPerpsState(), "Long", 100, 5));
  near(liquidationRatio(s.positions[0]), .425);
  s = ok(advanceFunding(s));
  near(s.positions[0].funding, .05);
  near(liquidationRatio(s.positions[0]), .42505);
  s = ok(setMark(s, .55));
  s = ok(closePosition(s, s.positions[0].id));
  near(s.freeUsdc, 10049.45);
  near(totals(s).realized, 49.45);
  near(totals(s).funding, .05);
});

test("Maintenance boundary liquidates at equality for Long and Short", () => {
  for (const side of ["Long", "Short"] as const) {
    let s = ok(openPosition(initialPerpsState(), side, 100, 5));
    const threshold = side === "Long" ? .425 : .575;
    near(liquidationRatio(s.positions[0]), threshold);
    s = ok(setMark(s, threshold));
    assert.equal(s.positions.length, 0);
    assert.equal(s.history[0].kind, "Liquidation");
    near(s.history[0].payout, 24.75);
    near(s.freeUsdc, 9924.5);
  }
});

test("Funding itself can trigger liquidation", () => {
  let s = ok(openPosition(initialPerpsState(), "Long", 100, 10));
  s = ok(setMark(s, .475025));
  assert.equal(s.positions.length, 1);
  near(equity(s.positions[0], s.mark), 50.05);
  s = ok(advanceFunding(s));
  assert.equal(s.positions.length, 0);
  assert.equal(s.history[0].kind, "Liquidation");
  near(totals(s).funding, .1);
});

test("Gap losses never consume free funds or another position's margin", () => {
  let s = ok(openPosition(initialPerpsState(), "Long", 100, 10));
  s = ok(openPosition(s, "Short", 200, 2));
  const free = s.freeUsdc;
  s = ok(setMark(s, .1));
  near(s.freeUsdc, free);
  assert.equal(s.positions.length, 1);
  near(s.positions[0].margin, 200);
  assert.equal(s.positions[0].side, "Short");
  assert.ok(s.history[0].shortfall > 0);
  near(s.history[0].net, -100.5);
  near(s.history[0].payout, 0);
});

test("Opening validates leverage, margin, quote, side and margin plus fee affordability", () => {
  const s = initialPerpsState();
  for (const m of [0, -1, .5, NaN, Infinity, 10000]) assert.equal(openPosition(s, "Long", m, 5).ok, false);
  for (const l of [0, 11, 1.5, NaN]) assert.equal(openPosition(s, "Long", 100, l).ok, false);
  assert.equal(openPosition({ ...s, mark: 0 }, "Long", 100, 5).ok, false);
  for (const r of [0, -1, NaN, Infinity, 101]) assert.equal(setMark(s, r).ok, false);
  for (let l = 1; l <= 10; l++) assert.equal(openPosition(s, "Long", 100, l).ok, true);
});

test("v2 validation rejects spot state; scenario history ends at the actual current mark", () => {
  assert.equal(isPerpsState({ balances: { TSLAx: 10 }, trades: [] }), false);
  let s = ok(setMark(initialPerpsState(), .55));
  s = ok(advanceFunding(s));
  assert.ok(isPerpsState(s));
  near(ratioSeries(s).at(-1)!.value, .55);
  assert.equal(ratioSeries(s).at(-1)!.timestamp, s.clock);
});
