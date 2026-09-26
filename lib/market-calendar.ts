// Scheduled US cash-equity closures, official NYSE/Nasdaq calendar, verified 2026-09-24.
// Unscheduled closures additionally fail closed through both quote.is_market_open flags.
import type { Session } from "./market";
const holidays: Record<string, string[]> = {
  "2026": ["01-01", "01-19", "02-16", "04-03", "05-25", "06-19", "07-03", "09-07", "11-26", "12-25"],
  "2027": ["01-01", "01-18", "02-15", "03-26", "05-31", "06-18", "07-05", "09-06", "11-25", "12-24"],
};
const early = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);
export function nyDate(now: number) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
/** Resolve a New York wall time to UTC. Session times/midnight avoid DST ambiguity. */
export function nyTime(date: string, hour: number, minute = 0) {
  const wall = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" }).formatToParts(wall);
  const offset = parts.find(p => p.type === "timeZoneName")!.value.match(/GMT([+-])(\d{2}):(\d{2})/)!;
  return wall - (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000;
}
export function marketSession(now: number): Session {
  const date = nyDate(now); const year = date.slice(0, 4);
  if (!holidays[year]) return { state: "unknown", date, closesAt: 0, label: "Session calendar unavailable" };
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const closesAt = nyTime(date, early.has(date) ? 13 : 16);
  const closedDay = day === 0 || day === 6 || holidays[year].includes(date.slice(5));
  const open = !closedDay && now >= nyTime(date, 9, 30) && now < closesAt;
  return { state: open ? "open" : "closed", date, closesAt, label: open ? `Market open · ${early.has(date) ? "13:00 early" : "16:00"} close ET` : "Market closed" };
}
