import { IndexSnapshot, MarketFeed, SOURCE, tradeAllowed } from "./market";
import { initialPerpsState, isPerpsState, PerpsState, Result, setMark } from "./perps";
export const LIVE_KEY = "pair-perps-twelve-v3";
export const ARCHIVE_KEY = "pair-perps-demo-v2-archive";
export function initialLiveAccount(now = Date.now()): PerpsState {
  // 0 is a no-index sentinel, never displayed or tradable. No synthetic start price.
  return { ...initialPerpsState(), version: 3, mark: 0, marks: [], clock: now, startedAt: now };
}
export function isLiveAccount(value: unknown): value is PerpsState {
  if (!value || typeof value !== "object") return false;
  const s = value as PerpsState;
  if (s.version !== 3 || !Array.isArray(s.positions) || !Array.isArray(s.history) || !Array.isArray(s.marks)) return false;
  if (s.mark === 0) return !s.positions.length && !s.history.length && !s.marks.length && s.acceptedIndex === undefined && s.freeUsdc === 10000 && Number.isFinite(s.clock) && Number.isFinite(s.startedAt);
  const a = s.acceptedIndex;
  return isPerpsState({ ...s, version: 2 }) && !!a && typeof a.id === "string" && a.source === SOURCE && Number.isFinite(a.timestamp) &&
    s.positions.every(p => p.dataSource === SOURCE && typeof p.entryIndexId === "string" && Number.isFinite(p.entryIndexTime));
}
export function adoptIndex(s: PerpsState, feed: MarketFeed | null, now: number): Result {
  if (s.version !== 3) return { ok: false, error: "Archived synthetic positions cannot use the real-data index." };
  if (!tradeAllowed(feed, now)) return { ok: false, error: "A valid synchronized index is required; during an open session both quotes must also be fresh. Calculations are paused." };
  const q = feed!.snapshot as IndexSnapshot;
  if (s.acceptedIndex && q.timestamp < s.acceptedIndex.timestamp) return { ok: false, error: "An older index cannot replace the accepted mark." };
  if (s.acceptedIndex?.id === q.id) return { ok: true, state: s, message: "Index unchanged." };
  return setMark({ ...s, acceptedIndex: { id: q.id, timestamp: q.timestamp, source: SOURCE } }, q.ratio);
}
