import "server-only";
import { UniverseProvider } from "./universe-provider";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyProviderDisk, ProviderDisk } from "./twelve-provider";

// SINGLE Node process, local durable disk only. Multiple instances/workers are unsupported.
// Cache/quota journal never contains credentials or raw provider error text.
const dir = path.join(process.cwd(), ".cache");
const file = path.join(dir, "pair-twelve-data-v1.json");
function restore(): ProviderDisk {
  if (!existsSync(file)) return emptyProviderDisk();
  const parsed = JSON.parse(readFileSync(file, "utf8")) as ProviderDisk;
  if (!parsed || !Number.isFinite(parsed.used) || parsed.used < 0 || !Number.isFinite(parsed.minuteUsed) || !Number.isFinite(parsed.quoteNext) || !parsed.histories || !parsed.historyNext) throw new Error("Invalid market quota journal");
  return parsed;
}
function persist(disk: ProviderDisk) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(disk), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
function limit(name: string, fallback: number, max: number) { const n = Number(process.env[name]); return Number.isInteger(n) && n >= 2 && n <= max ? n : fallback; }
const root = globalThis as typeof globalThis & { odadoUniverse?: UniverseProvider };
export function marketProvider() {
  if (!root.odadoUniverse) root.odadoUniverse = new UniverseProvider({
    key: process.env.TWELVE_DATA_API_KEY?.trim() ?? "", disk: restore(), persist,
    dayBudget: limit("TWELVE_DATA_DAILY_BUDGET", 750, 800), minuteBudget: limit("TWELVE_DATA_MINUTE_BUDGET", 8, 8),
    quoteMs: Math.max(120, Number(process.env.TWELVE_DATA_QUOTE_SECONDS) || 120) * 1000,
  });
  return root.odadoUniverse;
}
