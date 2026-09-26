import type { Pair } from "./catalog";
/** PAIR's fictional linear ratio perpetual. See public/perps-model.md. */
export const CONTRACT = "NVDA/TSLA";
export const PERPS_KEY = "pair-perps-demo-v2";
export const LEGACY_KEY = "pair-demo-state-v1";
export const INITIAL_USDC = 10_000;
export const FEE_RATE = 0.0005;
export const MAINTENANCE_RATE = 0.05;
export const FUNDING_RATE = 0.0001;
export const FUNDING_INTERVAL = 8 * 60 * 60 * 1000;
export const EPOCH = Date.UTC(2026, 8, 24, 16);
export type Side = "Long" | "Short";
export type Position = { pair?: Pair; mark?: number; id: string; side: Side; margin: number; leverage: number; notional: number; entryRatio: number; entryFee: number; funding: number; openedAt: number; lastFundingAt: number; dataSource?: string; entryIndexTime?: number; entryIndexId?: string };
export type Activity = { pair?: Pair; id: string; positionId: string; kind: "Open" | "Funding" | "Close" | "Liquidation"; side: Side; time: number; ratio: number; notional: number; pnl: number; fee: number; funding: number; payout: number; net: number; shortfall: number; dataSource?: string; indexTime?: number; entryIndexTime?: number };
export type Mark = { timestamp: number; value: number };
export type PerpsState = { version: 2 | 3 | 4; freeUsdc: number; mark: number; clock: number; startedAt: number; positions: Position[]; history: Activity[]; marks: Mark[]; acceptedIndex?: { id: string; timestamp: number; source: string } };
export type Result = { ok: true; state: PerpsState; message: string } | { ok: false; error: string };
export const direction = (side: Side) => side === "Long" ? 1 : -1;
export const num = (value: number, digits = 4) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
export const money = (value: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const signed = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
export const pnl = (p: Position, mark: number) => direction(p.side) * p.notional * (mark / p.entryRatio - 1);
export const equity = (p: Position, mark: number) => p.margin + pnl(p, mark) - p.funding;
export const maintenance = (p: Position) => p.notional * MAINTENANCE_RATE;
export const liquidationRatio = (p: Position) => p.entryRatio * (1 + direction(p.side) * (maintenance(p) - p.margin + p.funding) / p.notional);
export const closeFee = (p: Position) => p.notional * FEE_RATE;
export const netIfClosed = (p: Position, mark: number) => Math.max(0, equity(p, mark) - closeFee(p)) - p.margin - p.entryFee;
export const totals = (s: PerpsState) => ({
  margin: s.positions.reduce((v, p) => v + p.margin, 0),
  pnl: s.positions.reduce((v, p) => v + pnl(p, p.mark ?? s.mark), 0),
  equity: s.freeUsdc + s.positions.reduce((v, p) => v + Math.max(0, equity(p, p.mark ?? s.mark)), 0),
  fees: s.history.reduce((v, e) => v + e.fee, 0),
  funding: s.history.reduce((v, e) => v + e.funding, 0),
  realized: s.history.filter(e => e.kind === "Close" || e.kind === "Liquidation").reduce((v, e) => v + e.net, 0),
});

export function initialPerpsState(): PerpsState {
  return { version: 2, freeUsdc: INITIAL_USDC, mark: .5, clock: EPOCH, startedAt: EPOCH, positions: [], history: [], marks: [{ timestamp: EPOCH, value: .5 }] };
}

function activity(p: Position, s: PerpsState, kind: Activity["kind"], fields: Partial<Activity> = {}): Activity {
  return { id: crypto.randomUUID(), positionId: p.id, kind, side: p.side, time: s.clock, ratio: s.mark, notional: p.notional, pnl: 0, fee: 0, funding: 0, payout: 0, net: 0, shortfall: 0, ...(s.acceptedIndex ? { dataSource: s.acceptedIndex.source, indexTime: s.acceptedIndex.timestamp, entryIndexTime: p.entryIndexTime ?? s.acceptedIndex.timestamp } : {}), ...fields };
}

export function openPosition(s: PerpsState, side: Side, margin: number, leverage: number): Result {
  if (side !== "Long" && side !== "Short") return { ok: false, error: "Choose Long or Short." };
  if (!Number.isFinite(margin) || margin < 1 || margin > INITIAL_USDC * 1e6) return { ok: false, error: "Enter an isolated margin of at least 1 USDC." };
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 10) return { ok: false, error: "Leverage must be between 1x and 10x." };
  if (!Number.isFinite(s.mark) || s.mark <= 0) return { ok: false, error: "No valid demo ratio is available." };
  const notional = margin * leverage;
  const entryFee = notional * FEE_RATE;
  if (margin + entryFee > s.freeUsdc) return { ok: false, error: "Insufficient free demo USDC for margin and entry fee." };
  const p: Position = { id: crypto.randomUUID(), side, margin, leverage, notional, entryRatio: s.mark, entryFee, funding: 0, openedAt: s.clock, lastFundingAt: s.clock };
  return { ok: true, message: `${side} opened · ${money(notional)} USDC notional.`, state: { ...s, freeUsdc: s.freeUsdc - margin - entryFee, positions: [...s.positions, p], history: [activity(p, s, "Open", { fee: entryFee }), ...s.history] } };
}

function settle(s: PerpsState, p: Position, kind: "Close" | "Liquidation"): PerpsState {
  const gross = pnl(p, s.mark);
  const residual = equity(p, s.mark) - closeFee(p);
  const payout = Math.max(0, residual);
  const event = activity(p, s, kind, { pnl: gross, fee: closeFee(p), payout, net: payout - p.margin - p.entryFee, shortfall: Math.max(0, -residual) });
  return { ...s, freeUsdc: s.freeUsdc + payout, positions: s.positions.filter(item => item.id !== p.id), history: [event, ...s.history] };
}

function liquidate(s: PerpsState): PerpsState {
  let next = s;
  for (const p of s.positions) {
    if (equity(p, s.mark) <= maintenance(p) + 1e-9) next = settle(next, p, "Liquidation");
  }
  return next;
}

export function closePosition(s: PerpsState, id: string): Result {
  const p = s.positions.find(item => item.id === id);
  if (!p) return { ok: false, error: "This position is already closed." };
  return { ok: true, message: "Position closed. Remaining margin and PnL settled to free demo USDC.", state: settle(s, p, equity(p, s.mark) <= maintenance(p) + 1e-9 ? "Liquidation" : "Close") };
}

export function setMark(s: PerpsState, mark: number): Result {
  if (!Number.isFinite(mark) || mark <= 0 || (s.version === 2 && (mark < .0001 || mark > 100))) return { ok: false, error: "No valid positive ratio is available." };
  // Marks may move at the same simulated time. Funding time moves only via Advance 8h.
  const next = liquidate({ ...s, mark, marks: [...s.marks, { timestamp: s.clock, value: mark }].slice(-500) });
  const count = s.positions.length - next.positions.length;
  return { ok: true, state: next, message: count ? `Ratio updated. ${count} isolated position(s) liquidated.` : "Demo ratio updated." };
}

export function advanceFunding(s: PerpsState): Result {
  let next: PerpsState = { ...s, clock: s.clock + FUNDING_INTERVAL };
  const events: Activity[] = [];
  const positions = s.positions.map(p => {
    const periods = Math.floor((next.clock - p.lastFundingAt) / FUNDING_INTERVAL);
    const payment = direction(p.side) * p.notional * FUNDING_RATE * periods;
    if (periods) events.push(activity(p, next, "Funding", { funding: payment }));
    return { ...p, funding: p.funding + payment, lastFundingAt: p.lastFundingAt + periods * FUNDING_INTERVAL };
  });
  next = liquidate({ ...next, positions, history: [...events, ...s.history], marks: [...s.marks, { timestamp: next.clock, value: s.mark }].slice(-500) });
  return { ok: true, state: next, message: `Demo clock advanced 8h. Funding settled${next.positions.length < s.positions.length ? "; maintenance breach triggered liquidation" : ""}.` };
}

export function isPerpsState(value: unknown): value is PerpsState {
  if (!value || typeof value !== "object") return false;
  const s = value as PerpsState;
  const finite = (n: number) => Number.isFinite(n);
  if (s.version !== 2 || !finite(s.freeUsdc) || s.freeUsdc < 0 || !finite(s.mark) || s.mark <= 0 || !finite(s.clock) || !finite(s.startedAt)) return false;
  return Array.isArray(s.positions) && s.positions.every(p => p && typeof p.id === "string" && ["Long", "Short"].includes(p.side) && [p.margin, p.notional, p.entryRatio].every(n => finite(n) && n > 0) && Number.isInteger(p.leverage) && p.leverage >= 1 && p.leverage <= 10 && Math.abs(p.notional - p.margin * p.leverage) < 1e-6 && [p.entryFee, p.funding, p.openedAt, p.lastFundingAt].every(finite)) &&
    Array.isArray(s.history) && s.history.every(e => e && typeof e.id === "string" && typeof e.positionId === "string" && ["Open", "Funding", "Close", "Liquidation"].includes(e.kind) && ["Long", "Short"].includes(e.side) && [e.time, e.ratio, e.notional, e.pnl, e.fee, e.funding, e.payout, e.net, e.shortfall].every(finite)) &&
    Array.isArray(s.marks) && s.marks.length > 0 && s.marks.every(m => m && finite(m.timestamp) && finite(m.value) && m.value > 0);
}

export const ranges = ["1D", "7D", "30D", "90D", "1Y"] as const;
export type ChartRange = typeof ranges[number];
export function ratioSeries(s: PerpsState, range: ChartRange = "30D") {
  const days = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 }[range];
  const start = s.clock - days * 86400000;
  const historical = Array.from({ length: 80 }, (_, i) => {
    const timestamp = start + (EPOCH - start) * i / 79;
    const ago = (EPOCH - timestamp) / 86400000;
    return { timestamp, value: .5 * Math.exp(-.022 * Math.sqrt(Math.max(0, ago)) + .014 * Math.sin(ago * 1.3)) };
  }).filter(m => m.timestamp < EPOCH && m.timestamp >= start);
  // Equal-time scenario edits stay visible in their order of application.
  return [...historical, ...s.marks.filter(m => m.timestamp >= start)].map((m, index) => ({ ...m, index, label: new Date(m.timestamp).toLocaleString("en-US", range === "1D" ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }) }));
}
