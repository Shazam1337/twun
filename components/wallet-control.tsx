"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronDown,Copy,Wallet,X} from "lucide-react";
import {EvmProvider,EvmWallet,evmAddress,evmChain,ROBINHOOD_CHAIN,switchRobinhood,walletError} from "@/lib/evm-wallet";

export function WalletControl({compact=false,rounded=false}:{compact?:boolean;rounded?:boolean}){
 const [wallets,setWallets]=useState<EvmWallet[]>([]),[selected,setSelected]=useState<EvmWallet|null>(null);
 const [address,setAddress]=useState<string|null>(null),[chain,setChain]=useState<string|null>(null);
 const [isOpen,setIsOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const generation=useRef(0),pending=useRef(false);
 useEffect(()=>{
  const announce=(event:Event)=>{
   const d=(event as CustomEvent).detail;
   if(!d?.info||typeof d.info.uuid!=="string"||typeof d.info.name!=="string"||typeof d.provider?.request!=="function")return;
   const entry={id:d.info.uuid,name:d.info.name.slice(0,60),provider:d.provider as EvmProvider};
   setWallets(old=>{const existing=old.find(w=>w.provider===entry.provider);return existing?old.map(w=>w===existing?entry:w):old.some(w=>w.id===entry.id)?old:[...old,entry];});
  };
  window.addEventListener("eip6963:announceProvider",announce);
  const discover=()=>{
   window.dispatchEvent(new Event("eip6963:requestProvider"));
   const injected=(window as Window&{ethereum?:EvmProvider&{providers?:EvmProvider[]}}).ethereum;
   if(injected)setWallets(old=>{const list=[...old];for(const [i,p] of (injected.providers??[injected]).entries())if(typeof p?.request==="function"&&!list.some(w=>w.provider===p))list.push({id:"legacy-"+i,name:"Browser EVM wallet",provider:p});return list;});
  };
  discover();window.addEventListener("ethereum#initialized",discover);
  return()=>{generation.current++;window.removeEventListener("eip6963:announceProvider",announce);window.removeEventListener("ethereum#initialized",discover);};
 },[]);
 useEffect(()=>{
  if(!selected)return;const p=selected.provider;
  const accounts=(v:unknown)=>{generation.current++;pending.current=false;setBusy(false);const next=evmAddress(v);setAddress(next);if(!next){setSelected(null);setChain(null);}};
  const chains=(v:unknown)=>setChain(evmChain(v));
  const disconnected=()=>{generation.current++;pending.current=false;setBusy(false);setAddress(null);setChain(null);setSelected(null);setNotice("Wallet disconnected. Demo positions are unchanged.");};
  p.on?.("accountsChanged",accounts);p.on?.("chainChanged",chains);p.on?.("disconnect",disconnected);
  return()=>{p.removeListener?.("accountsChanged",accounts);p.removeListener?.("chainChanged",chains);p.removeListener?.("disconnect",disconnected);};
 },[selected]);
 const connect=async(w:EvmWallet)=>{
  if(pending.current)return;pending.current=true;const id=++generation.current;setBusy(true);setNotice("");
  try{const accounts=await w.provider.request({method:"eth_requestAccounts"}),network=evmChain(await w.provider.request({method:"eth_chainId"})),next=evmAddress(accounts);if(!next||!network)throw Error("Invalid wallet response");if(id===generation.current){setSelected(w);setAddress(next);setChain(network);setIsOpen(network!==ROBINHOOD_CHAIN.chainId);}}
  catch(e){if(id===generation.current)setNotice(walletError(e));}finally{if(id===generation.current){pending.current=false;setBusy(false);}}
 };
 const switchNetwork=async()=>{
  if(!selected||pending.current)return;pending.current=true;const id=++generation.current;setBusy(true);setNotice("");
  try{const network=await switchRobinhood(selected.provider);if(id===generation.current)setChain(network);}catch(e){if(id===generation.current)setNotice(walletError(e));}finally{if(id===generation.current){pending.current=false;setBusy(false);}}
 };
 const disconnect=()=>{generation.current++;pending.current=false;setBusy(false);setAddress(null);setChain(null);setSelected(null);setNotice("");setIsOpen(false);};
 return <div className="relative">
  <button onClick={()=>{setIsOpen(v=>!v);window.dispatchEvent(new Event("eip6963:requestProvider"));}} className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-[var(--ink)] ${compact?"px-3":"px-4"} ${rounded?"rounded-full":""} text-xs font-bold text-[var(--milk)] transition hover:bg-black`}>
   {address?<>{address.slice(0,6)}…{address.slice(-4)}<ChevronDown size={14}/></>:<><Wallet size={14}/>{busy?"Connecting…":compact?"Connect":"Connect wallet"}</>}
  </button>
  {isOpen&&<div role="dialog" aria-label={address?"EVM wallet account":"Connect an EVM wallet"} className="absolute right-0 z-50 mt-2 w-72 border border-[var(--line)] bg-[var(--milk)] p-4 shadow-2xl">
   <div className="mb-3 flex items-start justify-between gap-2"><div><p className="text-sm font-extrabold">{address?selected?.name:"Connect an EVM wallet"}</p><p className="mt-1 text-[11px] leading-relaxed opacity-70">Robinhood Chain · Demo trading. No signatures or transactions.</p></div><button aria-label="Close wallet menu" onClick={()=>setIsOpen(false)}><X size={16}/></button></div>
   {address?<>
    <p className="mono break-all text-xs">{address}</p>
    <p className="my-3 text-xs">{chain===ROBINHOOD_CHAIN.chainId?"Robinhood Chain · 4663":"Different network"+(chain?" · Chain ID "+BigInt(chain).toString():"")}</p>
    {chain!==ROBINHOOD_CHAIN.chainId&&<button disabled={busy} onClick={()=>void switchNetwork()} className="mb-3 w-full border border-[var(--ink)] bg-[var(--yellow)] p-2 text-xs font-bold">{busy?"Check your wallet…":"Switch to Robinhood Chain"}</button>}
    <div className="flex gap-2"><button onClick={()=>void navigator.clipboard.writeText(address).then(()=>setNotice("Address copied.")).catch(()=>setNotice("Copy unavailable. Select the address above."))} className="flex flex-1 items-center justify-center gap-1 border border-[var(--line)] py-2 text-xs font-bold"><Copy size={12}/>Copy</button><button onClick={disconnect} className="flex flex-1 items-center justify-center gap-1 bg-[var(--ink)] py-2 text-xs font-bold text-white"><X size={12}/>Disconnect</button></div>
    <p className="mt-2 text-[10px] opacity-70">Disconnect ends this app session. Wallet permissions are managed in your wallet. Demo balance stays in this browser.</p>
   </>:<>
    {wallets.map(w=><button disabled={busy} key={w.id} onClick={()=>void connect(w)} className="mb-2 flex w-full items-center gap-2 border border-[var(--line)] p-3 text-left text-sm font-bold hover:bg-[var(--taupe)]"><Wallet size={18}/>{w.name}</button>)}
    {!wallets.length&&<p role="status" className="my-3 text-xs leading-relaxed">No EVM wallet detected. Install MetaMask or Rabby, refresh this page, then connect. The demo works without a wallet.</p>}
    <div className="mt-3 flex gap-4 text-xs font-bold underline"><a href="https://metamask.io/download" target="_blank" rel="noopener noreferrer">MetaMask ↗</a><a href="https://rabby.io/" target="_blank" rel="noopener noreferrer">Rabby ↗</a></div>
    <a href="https://docs.robinhood.com/chain/add-network-to-wallet/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs underline">Robinhood Wallet / network setup ↗</a>
    <p className="mt-2 text-[10px] opacity-70">Browser EVM providers only. Mobile QR / WalletConnect is not enabled. This is not a Robinhood brokerage login.</p>
   </>}
   {notice&&<p role="status" className="mt-3 text-xs leading-relaxed">{notice}</p>}
  </div>}
 </div>;
}
