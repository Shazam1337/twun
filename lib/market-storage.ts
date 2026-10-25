import { randomUUID } from "node:crypto";
import { emptyProviderDisk } from "./twelve-provider";
import type { UniverseDisk } from "./universe-provider";

export class MarketStorageError extends Error {
 constructor(public reason:"not_configured"|"unavailable"|"busy"|"lease_lost"="unavailable"){super("Shared market storage "+reason);}
}
export type MarketLease={disk:UniverseDisk;save:(disk:UniverseDisk)=>Promise<void>;release:()=>Promise<void>};
export interface MarketStorage {read():Promise<UniverseDisk>;acquire():Promise<MarketLease|null>}
// Keys share one Redis hash slot. All critical reads and writes run inside Lua.
export const ACQUIRE="if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return {1, redis.call('GET', KEYS[2]) or ''} else return {0, ''} end";
export const COMMIT="if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2]) redis.call('PEXPIRE', KEYS[1], ARGV[3]) return 1";
export const RELEASE="if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
export const READ="return redis.call('GET', KEYS[1])";
/** Reject a malformed journal instead of silently resetting the quota. */
export function parseMarketDisk(raw:unknown):UniverseDisk {
 if(raw===null||raw==="")return emptyProviderDisk();
 try{
  if(typeof raw!=="string")throw Error();
  const state=JSON.parse(raw),d=state.disk;
  if(state.version!==1||!d||typeof d.day!=="string"||!/^$|^\d{4}-\d{2}-\d{2}$/.test(d.day))throw Error();
  for(const k of ["used","minuteUsed","minute","blockedUntil","failures","quoteNext"])if(!Number.isFinite(d[k])||d[k]<0)throw Error();
  if(!d.histories||!d.historyNext||!d.universe)throw Error();
  for(const k of ["quotes","histories","catalog","logosChecked"])if(!d.universe[k]||typeof d.universe[k]!=="object"||Array.isArray(d.universe[k]))throw Error();
  return d as UniverseDisk;
 }catch{throw new MarketStorageError();}
}
/** Upstash REST, no browser token, filesystem, auto-retry or background work. */
export class RedisMarketStorage implements MarketStorage {
 private url:string;private lock:string;private state:string;
 constructor(private options:{url:string;token:string;namespace?:string;fetcher?:typeof fetch;leaseMs?:number}){
  try{const u=new URL(options.url);if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw Error();this.url=u.href;}catch{throw new MarketStorageError("not_configured");}
  if(!options.token)throw new MarketStorageError("not_configured");
  const namespace=options.namespace??"twun-market-v1";
  if(!/^[a-zA-Z0-9:_-]{1,80}$/.test(namespace))throw new MarketStorageError("not_configured");
  this.lock=`{${namespace}}:lock`;this.state=`{${namespace}}:state`;
 }
 private async command(args:(string|number)[]):Promise<unknown>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  try{
   const r=await (this.options.fetcher??fetch)(this.url,{method:"POST",headers:{Authorization:`Bearer ${this.options.token}`,"Content-Type":"application/json"},body:JSON.stringify(args),signal:controller.signal,cache:"no-store",redirect:"error"});
   if(!r.ok)throw Error();const data=await r.json();if(!data||typeof data!=="object"||"error" in data||!("result" in data))throw Error();return data.result;
  }catch{throw new MarketStorageError();}finally{clearTimeout(timer);}
 }
 async read(){return parseMarketDisk(await this.command(["EVAL",READ,1,this.state]));}
 async acquire():Promise<MarketLease|null>{
  const token=randomUUID(),ttl=this.options.leaseMs??90000;
  const result=await this.command(["EVAL",ACQUIRE,2,this.lock,this.state,token,ttl]);
  if(!Array.isArray(result)||![0,1].includes(result[0]))throw new MarketStorageError();
  if(result[0]===0)return null;
  const release=async()=>{await this.command(["EVAL",RELEASE,1,this.lock,token]);};
  try{
   const disk=parseMarketDisk(result[1]);
   return {disk,release,save:async(d)=>{
    const value=JSON.stringify({version:1,disk:d});
    if(await this.command(["EVAL",COMMIT,2,this.lock,this.state,token,value,ttl])!==1)throw new MarketStorageError("lease_lost");
   }};
  }catch(error){await release().catch(()=>{});throw error;}
 }
}
