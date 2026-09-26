import { loadEnvConfig } from '@next/env';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { STOCKS } from '../lib/catalog';
import { UniverseProvider, UniverseDisk } from '../lib/universe-provider';
import { emptyProviderDisk } from '../lib/twelve-provider';
loadEnvConfig(process.cwd());
async function main() {
 const key=process.env.TWELVE_DATA_API_KEY?.trim();
 if(!key){console.log('Market data not configured');return;}
 const file='.cache/pair-twelve-data-v1.json';
 const disk:UniverseDisk=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):emptyProviderDisk();
 const provider=new UniverseProvider({key,disk,persist:s=>{mkdirSync('.cache',{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(s));renameSync(file+'.tmp',file);}});
 for(const stock of STOCKS){
  for(;;){
   const result=await provider.verify(stock.symbol), a=result.catalog[stock.symbol];
   const done=(s:string|undefined)=>!!s&&!["quota_exhausted","unavailable"].includes(s);
   if(a?.quote?.checkedAt&&a?.history5min?.checkedAt&&a?.history1day?.checkedAt&&[a.quote.status,a.history5min.status,a.history1day.status,a.logoStatus].every(done)){console.log(stock.symbol,JSON.stringify(a));break;}
   if(result.budget.used>=result.budget.limit){console.log('Daily budget exhausted; incomplete audit.');return;}
   await new Promise(r=>setTimeout(r,15000));
  }
 }
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/catalog-availability.json',JSON.stringify({checkedAt:new Date().toISOString(),catalog:provider.catalog()},null,2));
 console.log('Catalog audit complete.');
}
main().catch(()=>{console.error('Catalog audit failed; no credentials logged.');process.exitCode=1;});
