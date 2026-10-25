import "server-only";
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from "node:fs";
import path from "node:path";
import {emptyProviderDisk} from "./twelve-provider";
import {MarketLease,MarketStorage,parseMarketDisk,RedisMarketStorage} from "./market-storage";
import {NewsProvider} from "./news-provider";
import {emptyNews} from "./news";
import {stock} from "./catalog";
class LocalNewsStorage implements MarketStorage{
 private locked=false;private file=path.join(process.cwd(),".cache","twun-news-v1.json");
 async read(){return existsSync(this.file)?parseMarketDisk(readFileSync(this.file,"utf8")):emptyProviderDisk();}
 async acquire():Promise<MarketLease|null>{
  if(this.locked)return null;this.locked=true;
  try{return {disk:await this.read(),save:async disk=>{mkdirSync(path.dirname(this.file),{recursive:true});writeFileSync(this.file+".tmp",JSON.stringify({version:1,disk}),{mode:0o600});renameSync(this.file+".tmp",this.file);},release:async()=>{this.locked=false;}};}
  catch(error){this.locked=false;throw error;}
 }
}
const root=globalThis as typeof globalThis&{twunNews?:NewsProvider};
const limit=(name:string,fallback:number,max:number)=>{const n=Number(process.env[name]);return Number.isInteger(n)&&n>0&&n<=max?n:fallback;};
function newsProvider(){
 const key=process.env.FINNHUB_API_KEY?.trim()??"";
  if(!root.twunNews){
   const url=process.env.UPSTASH_REDIS_REST_URL?.trim()||process.env.KV_REST_API_URL?.trim()||"",token=process.env.UPSTASH_REDIS_REST_TOKEN?.trim()||process.env.KV_REST_API_TOKEN?.trim()||"";
   const shared=!!(process.env.VERCEL||url||token);
   const namespace=process.env.NEWS_REDIS_NAMESPACE?.trim()||"twun-news-v1";
   if(namespace===(process.env.MARKET_REDIS_NAMESPACE?.trim()||"twun-market-v1"))throw Error("News requires a separate quota namespace");
   const storage=shared?new RedisMarketStorage({url,token,namespace}):new LocalNewsStorage();
   root.twunNews=new NewsProvider({key,storage,dayBudget:limit("NEWS_API_DAILY_BUDGET",500,10000),minuteBudget:limit("NEWS_API_MINUTE_BUDGET",10,60),ttlMs:Math.max(300,Number(process.env.NEWS_REFRESH_SECONDS)||600)*1000,catalogTtlMs:Math.max(21600,Number(process.env.NEWS_CATALOG_REFRESH_SECONDS)||21600)*1000});
  }
 return root.twunNews;
}
export async function getNews(scope="market"){
 if(scope!=="market"&&!stock(scope))throw Error("Unknown news scope");
 if(!process.env.FINNHUB_API_KEY?.trim())return emptyNews(scope,"not_configured");
 try{return await newsProvider().get(scope);}catch{return emptyNews(scope,"storage_unavailable");}
}
export async function getProfiles(priority:string[]=[]){
 if(!process.env.FINNHUB_API_KEY?.trim())return {provider:"Finnhub" as const,entries:{},status:"not_configured" as const,retryAt:0,serverTime:Date.now()};
 return await newsProvider().profiles(priority);
}
