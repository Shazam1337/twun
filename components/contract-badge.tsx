"use client";
import {useEffect,useRef,useState} from "react";
import {Check,Copy} from "lucide-react";
import {contractAddress,shortContract} from "@/lib/contract-address";
// Unmodified official monochrome Robinhood Chain symbol, served locally.
// Source: https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/feather-dark.svg
const CHAIN_ICON="/robinhood-chain-feather.svg";
export function ContractBadge(){
 const address=contractAddress(process.env.NEXT_PUBLIC_TWUN_CONTRACT_ADDRESS)??"0xbc03c56e8ed64e364787a54593b2f1a590d31efb";
 const copyText=address??"0x000...000";
 const [notice,setNotice]=useState(""),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(copyText);setNotice("Copied");}
  catch{setNotice("Could not copy. Select the address shown below.");}
  if(timer.current)clearTimeout(timer.current);
  timer.current=setTimeout(()=>setNotice(""),5000);
 };
 return <div className="twun-contract-wrap">
  <button className="twun-contract-badge" aria-label={address?`Copy Robinhood Chain contract address ${address}`:`Copy placeholder contract address ${copyText}`} aria-describedby="twun-contract-tooltip" onClick={()=>void copy()}>
   <img src={CHAIN_ICON} width="16" height="21" alt="" aria-hidden="true"/><span className="twun-contract-label">CA:</span><span className="mono">{address?shortContract(address):copyText}</span>{notice==="Copied"?<Check size={12}/>:<Copy size={12}/>}
  </button>
  <span className="sr-only" role="status">{notice}</span>
  <div id="twun-contract-tooltip" className="twun-contract-notice" role="tooltip" data-visible={!!notice}>{notice||(address?"Click to copy full contract address":"Click to copy")}{address&&!notice&&<code>{address}</code>}{notice&&notice!=="Copied"&&<code>{copyText}</code>}</div>
 </div>;
}
