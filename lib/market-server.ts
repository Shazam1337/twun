import "server-only";
import { UniverseProvider } from "./universe-provider";
import { SharedMarket } from "./shared-market";
import { MarketStorageError, RedisMarketStorage } from "./market-storage";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyProviderDisk, ProviderDisk } from "./twelve-provider";
import type { Pair } from "./catalog";
import type { Interval } from "./market";

const dir=path.join(process.cwd(),".cache"),file=path.join(dir,"pair-twelve-data-v1.json");
function restore():ProviderDisk{
 if(!existsSync(file))return emptyProviderDisk();
 const d=JSON.parse(readFileSync(file,"utf8")) as ProviderDisk;
 if(!d||!Number.isFinite(d.used)||d.used<0||!Number.isFinite(d.minuteUsed)||!Number.isFinite(d.quoteNext)||!d.histories||!d.historyNext)throw Error("Invalid market quota journal");
 return d;
}
function persist(d:ProviderDisk){mkdirSync(dir,{recursive:true});writeFileSync(file+".tmp",JSON.stringify(d),{mode:0o600});renameSync(file+".tmp",file);}
function limit(name:string,fallback:number,max:number,min=2){const n=Number(process.env[name]);return process.env[name]?.trim()&&Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
type Service=Pick<UniverseProvider,"get"|"ticker"|"refreshTicker"|"catalog"|"historyPage"|"analytics">|SharedMarket;
const root=globalThis as typeof globalThis&{twunMarket?:Service;twunLocal?:UniverseProvider};
function redisConfig(){return {url:process.env.UPSTASH_REDIS_REST_URL?.trim()||process.env.KV_REST_API_URL?.trim()||"",token:process.env.UPSTASH_REDIS_REST_TOKEN?.trim()||process.env.KV_REST_API_TOKEN?.trim()||""};}
function configured(){
 const key=process.env.TWELVE_DATA_API_KEY?.trim()??"",redis=redisConfig();
 // No key: return the existing honest empty state without any storage or upstream IO.
 if(!key)return new UniverseProvider({key:""});
 const options={key,dayBudget:limit("TWELVE_DATA_DAILY_BUDGET",750,800),minuteBudget:limit("TWELVE_DATA_MINUTE_BUDGET",8,8),tickerDayBudget:limit("TWELVE_DATA_TICKER_DAILY_BUDGET",180,750,0),quoteMs:Math.max(120,Number(process.env.TWELVE_DATA_QUOTE_SECONDS)||120)*1000};
 if(process.env.VERCEL||redis.url||redis.token){
  if(!redis.url||!redis.token)throw new MarketStorageError("not_configured");
  return new SharedMarket({...options,storage:new RedisMarketStorage({...redis,namespace:process.env.MARKET_REDIS_NAMESPACE?.trim()||"twun-market-v1"})});
 }
 // Filesystem is local development only. Never used on Vercel.
 return root.twunLocal??=new UniverseProvider({...options,disk:restore(),persist});
}
export function marketProvider(){
 const service=()=>root.twunMarket??=configured();
 return {
  async get(pair:Pair,watch:string[],interval:Interval,historySeconds=300){
   try{return await service().get(pair,watch,interval,historySeconds);}
   catch(error){
    const empty=new UniverseProvider({key:""}).snapshot(pair,interval);
    empty.market={...empty.market,status:"unavailable",message:error instanceof MarketStorageError&&error.reason==="not_configured"?"Shared market data storage is not configured":"Market data storage unavailable — updates paused",canTrade:false};
    return empty;
   }
  },
  async ticker(){return await service().refreshTicker();},
  async historyPage(pair:Pair,before:number){return await service().historyPage(pair,before);},
  async catalog(){return await service().catalog();},
  async analytics(pair:Pair){return await service().analytics(pair);},
 };
}
export async function verifyLocalCatalog(symbol:string){
 const redis=redisConfig();
 if(process.env.VERCEL||redis.url||redis.token)throw new Error("Catalog verification is local only");
 const provider=root.twunLocal??configured();
 if(!(provider instanceof UniverseProvider))throw new Error("Local provider required");
 return provider.verify(symbol);
}
