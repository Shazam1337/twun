import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {FeedbackError,FeedbackInput,FeedbackTicket} from "./feedback";
type RecordEntry={ticket:FeedbackTicket;fingerprint:string};
type Journal={version:1;entries:RecordEntry[];hour:number;count:number;clients:Record<string,number>};
export interface FeedbackStorage {save(input:FeedbackInput,client:string):Promise<FeedbackTicket>;list():Promise<FeedbackTicket[]>}
const entry=(input:FeedbackInput):RecordEntry=>({fingerprint:createHash("sha256").update(JSON.stringify(input)).digest("hex"),ticket:{...input,reference:`TWUN-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${input.id.slice(0,8)}`,createdAt:new Date().toISOString(),status:"Received"}});
export class LocalFeedbackStorage implements FeedbackStorage {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 private async read():Promise<Journal>{try{const j=JSON.parse(await readFile(this.file,"utf8"));if(j.version!==1||!Array.isArray(j.entries)||!j.clients||typeof j.count!=="number")throw Error("Invalid feedback journal");return j;}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return {version:1,entries:[],hour:0,count:0,clients:{}};throw e;}}
 async save(input:FeedbackInput,client:string){const task=this.queue.then(async()=>{
  const j=await this.read(),e=entry(input),old=j.entries.find(v=>v.ticket.id===input.id);
  if(old){if(old.fingerprint!==e.fingerprint)throw new FeedbackError("This submission ID was already used. Start a new ticket.",409);return old.ticket;}
  const hour=Math.floor(Date.now()/3600000);if(j.hour!==hour){j.hour=hour;j.count=0;j.clients={};}
  if(j.count>=60||(j.clients[client]||0)>=5)throw new FeedbackError("Submission limit reached. Please try again next hour.",429);
  if(j.entries.length>=2000)throw new FeedbackError("The feedback inbox is full. Please try later.",503);
  j.entries.unshift(e);j.count++;j.clients[client]=(j.clients[client]||0)+1;
  await mkdir(path.dirname(this.file),{recursive:true});const temporary=this.file+"."+randomUUID()+".tmp";await writeFile(temporary,JSON.stringify(j),{mode:0o600});await rename(temporary,this.file);return e.ticket;
 });this.queue=task.catch(()=>{});return task;}
 async list(){await this.queue;return (await this.read()).entries.slice(0,50).map(e=>e.ticket);}
}
// All keys share a Redis hash slot. Receipt, rate counters and inbox are committed atomically.
const SAVE=`local old=redis.call('GET',KEYS[1]); if old then local v=cjson.decode(old); if v.fingerprint~=ARGV[2] then return 'conflict' end; return old end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=60 or tonumber(redis.call('GET',KEYS[4]) or '0')>=5 then return 'rate' end
if redis.call('LLEN',KEYS[2])>=2000 then return 'full' end
redis.call('SET',KEYS[1],ARGV[1]);redis.call('LPUSH',KEYS[2],KEYS[1]);redis.call('INCR',KEYS[3]);redis.call('EXPIRE',KEYS[3],7200);redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],7200);return ARGV[1]`;
export class RedisFeedbackStorage implements FeedbackStorage {
 private prefix:string;
 constructor(private url:string,private token:string,namespace:string,private fetcher:typeof fetch=fetch){const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password||u.search||u.pathname!=="/"||!token||!/^[-a-zA-Z0-9_]{1,80}$/.test(namespace))throw Error("Invalid feedback storage configuration");this.prefix=`{${namespace}}`;}
 private async command(command:(string|number)[]):Promise<unknown>{const r=await this.fetcher(this.url,{method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},body:JSON.stringify(command),signal:AbortSignal.timeout(5000),cache:"no-store"});if(!r.ok)throw Error("Feedback storage unavailable");const body=await r.json();if(body.error)throw Error("Feedback storage unavailable");return body.result;}
 async save(input:FeedbackInput,client:string){const e=entry(input),hour=Math.floor(Date.now()/3600000),r=await this.command(["EVAL",SAVE,4,`${this.prefix}:ticket:${input.id}`,`${this.prefix}:inbox`,`${this.prefix}:hour:${hour}`,`${this.prefix}:client:${hour}:${client}`,JSON.stringify(e),e.fingerprint]);
  if(r==="rate")throw new FeedbackError("Submission limit reached. Please try again next hour.",429);if(r==="conflict")throw new FeedbackError("This submission ID was already used. Start a new ticket.",409);if(r==="full")throw new FeedbackError("The feedback inbox is full. Please try later.",503);if(typeof r!=="string")throw Error("Invalid storage response");return (JSON.parse(r) as RecordEntry).ticket;
 }
 async list(){const keys=await this.command(["LRANGE",`${this.prefix}:inbox`,0,49]);if(!Array.isArray(keys))throw Error("Invalid inbox response");if(!keys.length)return [];const entries=await this.command(["MGET",...keys]);if(!Array.isArray(entries))throw Error("Invalid inbox response");return entries.filter(v=>typeof v==="string").map(v=>(JSON.parse(v) as RecordEntry).ticket);}
}
