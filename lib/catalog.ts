export type Stock = { symbol: string; name: string; sector: string; exchange: "NASDAQ" | "NYSE" };
// Product selection of widely followed, liquid US-listed equities, NOT a market-cap ranking.
const rows = [
  ["AAPL","Apple","Technology","NASDAQ"],["MSFT","Microsoft","Technology","NASDAQ"],["NVDA","NVIDIA","Technology","NASDAQ"],["AVGO","Broadcom","Technology","NASDAQ"],
  ["AMD","Advanced Micro Devices","Technology","NASDAQ"],["INTC","Intel","Technology","NASDAQ"],["QCOM","Qualcomm","Technology","NASDAQ"],["ORCL","Oracle","Technology","NYSE"],
  ["CRM","Salesforce","Technology","NYSE"],["ADBE","Adobe","Technology","NASDAQ"],["CSCO","Cisco","Technology","NASDAQ"],["IBM","IBM","Technology","NYSE"],
  ["GOOGL","Alphabet","Communication","NASDAQ"],["META","Meta Platforms","Communication","NASDAQ"],["NFLX","Netflix","Communication","NASDAQ"],["DIS","Walt Disney","Communication","NYSE"],["T","AT&T","Communication","NYSE"],
  ["AMZN","Amazon","Consumer discretionary","NASDAQ"],["TSLA","Tesla","Consumer discretionary","NASDAQ"],["HD","Home Depot","Consumer discretionary","NYSE"],["MCD","McDonald's","Consumer discretionary","NYSE"],["NKE","Nike","Consumer discretionary","NYSE"],["SBUX","Starbucks","Consumer discretionary","NASDAQ"],
  ["JPM","JPMorgan Chase","Financials","NYSE"],["BAC","Bank of America","Financials","NYSE"],["GS","Goldman Sachs","Financials","NYSE"],["MS","Morgan Stanley","Financials","NYSE"],["V","Visa","Financials","NYSE"],["MA","Mastercard","Financials","NYSE"],["BRK.B","Berkshire Hathaway","Financials","NYSE"],
  ["LLY","Eli Lilly","Healthcare","NYSE"],["UNH","UnitedHealth Group","Healthcare","NYSE"],["JNJ","Johnson & Johnson","Healthcare","NYSE"],["ABBV","AbbVie","Healthcare","NYSE"],["MRK","Merck","Healthcare","NYSE"],["PFE","Pfizer","Healthcare","NYSE"],
  ["WMT","Walmart","Consumer staples","NASDAQ"],["COST","Costco","Consumer staples","NASDAQ"],["PG","Procter & Gamble","Consumer staples","NYSE"],["KO","Coca-Cola","Consumer staples","NYSE"],["PEP","PepsiCo","Consumer staples","NASDAQ"],
  ["XOM","Exxon Mobil","Energy","NYSE"],["CVX","Chevron","Energy","NYSE"],["COP","ConocoPhillips","Energy","NYSE"],
  ["CAT","Caterpillar","Industrials","NYSE"],["GE","GE Aerospace","Industrials","NYSE"],["BA","Boeing","Industrials","NYSE"],
  ["NEE","NextEra Energy","Utilities","NYSE"],["LIN","Linde","Materials","NASDAQ"],["PLD","Prologis","Real estate","NYSE"],
] as const;
export const STOCKS: Stock[] = rows.map(([symbol,name,sector,exchange]) => ({symbol,name,sector,exchange}));
export const stock = (symbol: string) => STOCKS.find(s => s.symbol === symbol);
export type Pair = { base: string; quote: string };
export const DEFAULT_PAIR: Pair = { base: "NVDA", quote: "TSLA" };
export const pairId = (p: Pair) => `${p.base}/${p.quote}`;
export const canonicalPair = (p: Pair) => [p.base, p.quote].sort().join("/");
export const validPair = (p: unknown): p is Pair => !!p && typeof p === "object" && !!stock((p as Pair).base) && !!stock((p as Pair).quote) && (p as Pair).base !== (p as Pair).quote;
export function parsePair(id: string): Pair | null { const [base, quote, extra] = id.split("/"); const p = {base,quote}; return !extra && validPair(p) ? p : null; }
export const PRESETS: Pair[] = ["NVDA/TSLA","AAPL/MSFT","AMD/NVDA","GOOGL/META","AMZN/WMT","JPM/BAC","V/MA","XOM/CVX","KO/PEP","LLY/JNJ","CAT/GE","HD/COST"].map(id => parsePair(id)!);
export type Availability = { status: string; checkedAt: number; observations?: number };
export type CatalogStatus = Record<string, { quote?: Availability; history5min?: Availability; history1day?: Availability; logo?: string; logoStatus?: string }>;
