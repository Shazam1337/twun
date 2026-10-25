import { UniverseProvider, UniverseDisk } from "./universe-provider";
import { MarketStorageError } from "./market-storage";
import type { MarketStorage } from "./market-storage";
import type { Pair } from "./catalog";
import type { Interval } from "./market";

/** One distributed owner refreshes; other functions serve committed data only. */
export class SharedMarket {
 constructor(private options:{storage:MarketStorage;key:string;dayBudget?:number;minuteBudget?:number;quoteMs?:number;tickerDayBudget?:number;now?:()=>number;fetcher?:typeof fetch}){}
 private provider(disk:UniverseDisk,persist?:(disk:UniverseDisk)=>void|Promise<void>,fetcher?:typeof fetch){
  return new UniverseProvider({...this.options,disk,persist,fetcher:fetcher??this.options.fetcher});
 }
 async get(pair:Pair,watch:string[],interval:Interval,historySeconds=300){
  if(!this.options.key)return new UniverseProvider({key:""}).snapshot(pair,interval);
  const lease=await this.options.storage.acquire();
  if(!lease)return this.provider(await this.options.storage.read()).snapshot(pair,interval);
  let lastSaved=JSON.stringify(lease.disk);
  const persist=async(disk:UniverseDisk)=>{const value=JSON.stringify(disk);if(value!==lastSaved){await lease.save(disk);lastSaved=value;}};
  const deadline=Date.now()+25000;
  // Quota writes are awaited before each HTTP call. Expired owners cannot commit.
  const upstream:typeof fetch=async(input,init)=>{
   const remaining=deadline-Date.now();if(remaining<=0)throw new MarketStorageError("busy");
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(8000,remaining));
   const abort=()=>controller.abort();init?.signal?.addEventListener("abort",abort,{once:true});
   if(init?.signal?.aborted)controller.abort();
   try{return await (this.options.fetcher??fetch)(input,{...init,signal:controller.signal});}
   finally{clearTimeout(timer);init?.signal?.removeEventListener("abort",abort);}
  };
  try{
   const provider=this.provider(lease.disk,persist,upstream);
   const result=await provider.get(pair,watch,interval,historySeconds);
   await persist(lease.disk);
   return result;
  }finally{await lease.release().catch(()=>{});}
 }
 async ticker(){return this.provider(await this.options.storage.read()).ticker();}
 async analytics(pair:Pair){if(!this.options.key)return new UniverseProvider({key:""}).analyticsSnapshot(pair);const lease=await this.options.storage.acquire();if(!lease)return this.provider(await this.options.storage.read()).analyticsSnapshot(pair);try{return await this.provider(lease.disk,async disk=>{await lease.save(disk);}).analytics(pair);}finally{await lease.release().catch(()=>{});}}
 async refreshTicker(){
  if(!this.options.key)return new UniverseProvider({key:""}).ticker();
  const lease=await this.options.storage.acquire();
  if(!lease)return this.provider(await this.options.storage.read()).ticker();
  try{return await this.provider(lease.disk,async disk=>{await lease.save(disk);}).refreshTicker();}finally{await lease.release().catch(()=>{});}
 }
 async historyPage(pair:Pair,before:number){
  if(!this.options.key)return new UniverseProvider({key:""}).historyPageSnapshot(pair,before);
  const lease=await this.options.storage.acquire();
  if(!lease)return this.provider(await this.options.storage.read()).historyPageSnapshot(pair,before);
  try{return await this.provider(lease.disk,async disk=>{await lease.save(disk);}).historyPage(pair,before);}finally{await lease.release().catch(()=>{});}
 }
 async catalog(){return this.provider(await this.options.storage.read()).catalog();}
}
