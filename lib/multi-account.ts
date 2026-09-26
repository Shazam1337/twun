import { DEFAULT_PAIR, Pair, pairId, validPair } from "./catalog";
import { adoptIndex, initialLiveAccount, isLiveAccount } from "./live-account";
import { MarketFeed } from "./market";
import { advanceFunding, closePosition, openPosition, PerpsState, Result, Side } from "./perps";
export const MULTI_KEY="odado-perps-v4";
export type PairMark=Pick<PerpsState,"mark"|"marks"|"clock"|"acceptedIndex">;
export type MultiAccount=PerpsState & {version:4; pairMarks:Record<string,PairMark>};
export function migrateAccount(s:PerpsState=initialLiveAccount()):MultiAccount {
 return {...s,version:4,positions:s.positions.map(p=>({...p,pair:p.pair??DEFAULT_PAIR,mark:p.mark??s.mark})),history:s.history.map(e=>({...e,pair:e.pair??DEFAULT_PAIR})),pairMarks:{[pairId(DEFAULT_PAIR)]:{mark:s.mark,marks:s.marks,clock:s.clock,acceptedIndex:s.acceptedIndex}}};
}
export function isMultiAccount(value:unknown):value is MultiAccount {
 if(!value||typeof value!=="object")return false;
 const s=value as MultiAccount;
 if(s.version!==4||!s.pairMarks||!Number.isFinite(s.freeUsdc)||s.freeUsdc<0||!Array.isArray(s.positions)||!Array.isArray(s.history))return false;
 if(!s.positions.every(p=>p.pair&&validPair(p.pair)&&Number.isFinite(p.mark)&&p.mark!>0)||!s.history.every(e=>e.pair&&validPair(e.pair)))return false;
 const ids=new Set([...Object.keys(s.pairMarks),...s.positions.map(p=>pairId(p.pair!))]);
 return [...ids].every(id=>{const m=s.pairMarks[id];return m&&isLiveAccount({...s,...m,version:3,positions:s.positions.filter(p=>pairId(p.pair!)===id),history:s.history.filter(e=>pairId(e.pair!)===id),freeUsdc:m.mark===0?10000:s.freeUsdc});});
}
function slice(s:MultiAccount,pair:Pair):PerpsState {
 const id=pairId(pair), m=s.pairMarks[id]??initialLiveAccount(s.clock);
 return {...s,...m,version:3,freeUsdc:s.freeUsdc,positions:s.positions.filter(p=>pairId(p.pair??DEFAULT_PAIR)===id),history:[]};
}
function merge(s:MultiAccount,pair:Pair,result:Result):Result {
 if(!result.ok)return result;
 const r=result.state,id=pairId(pair);
 const next:MultiAccount={...s,freeUsdc:r.freeUsdc,pairMarks:{...s.pairMarks,[id]:{mark:r.mark,marks:r.marks,clock:r.clock,acceptedIndex:r.acceptedIndex}},positions:[...s.positions.filter(p=>pairId(p.pair??DEFAULT_PAIR)!==id),...r.positions.map(p=>({...p,pair,mark:r.mark}))],history:[...r.history.map(e=>({...e,pair})),...s.history]};
 return {...result,state:next};
}
export function adoptPair(s:MultiAccount,pair:Pair,feed:MarketFeed|null,now:number):Result {
 if(!feed?.snapshot||pairId(feed.snapshot.pair)!==pairId(pair))return {ok:false,error:"The index does not match this position's pair."};
 const part=slice(s,pair), r=adoptIndex(part,feed,now);
 if(r.ok&&r.state===part)return {...r,state:s};
 return merge(s,pair,r);
}
export function actOnPair(s:MultiAccount,pair:Pair,feed:MarketFeed|null,now:number,action:{kind:"open";side:Side;margin:number;leverage:number}|{kind:"close";id:string}|{kind:"funding"}):Result {
 if(action.kind==="funding"&&feed?.session.state!=="open")return {ok:false,error:"Model funding is paused outside the regular session. No overnight accrual or catch-up."};
 const adopted=adoptPair(s,pair,feed,now);if(!adopted.ok)return adopted;
 const accepted=adopted.state as MultiAccount,part=slice(accepted,pair);
 let result:Result;
 if(action.kind==="open"){
  result=openPosition(part,action.side,action.margin,action.leverage);
  if(result.ok){const last=result.state.positions.at(-1)!;result={...result,state:{...result.state,positions:result.state.positions.map(p=>p.id===last.id?{...p,dataSource:part.acceptedIndex!.source,entryIndexTime:part.acceptedIndex!.timestamp,entryIndexId:part.acceptedIndex!.id}:p)}};}
 }else result=action.kind==="close"?closePosition(part,action.id):advanceFunding(part);
 return merge(accepted,pair,result);
}
