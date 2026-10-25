"use client";

import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";
import {ArrowUpRight,X} from "lucide-react";

const WELCOME_KEY="twun-welcome-v1";

export function WelcomeDialog(){
 const dialog=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null);
 const router=useRouter();
 useEffect(()=>{
  let seen=false;
  try{seen=localStorage.getItem(WELCOME_KEY)==="seen";}catch{}
  const element=dialog.current;
  if(!seen&&element&&!element.open){element.showModal();title.current?.focus({preventScroll:true});}
  const sync=(event:StorageEvent)=>{if(event.key===WELCOME_KEY&&event.newValue==="seen")element?.close();};
  window.addEventListener("storage",sync);
  return()=>{window.removeEventListener("storage",sync);element?.close();};
 },[]);
 const dismiss=()=>{
  try{localStorage.setItem(WELCOME_KEY,"seen");}catch{}
  dialog.current?.close();
 };
 return <dialog ref={dialog} className="twun-welcome" aria-labelledby="twun-welcome-title" aria-describedby="twun-welcome-description" onCancel={event=>{event.preventDefault();dismiss();}}>
  <div className="twun-welcome-bar"><span className="twun-window-dots" aria-hidden="true"><i/><i/><i/></span><span>A QUICK INTRODUCTION</span><button type="button" aria-label="Close introduction" onClick={dismiss}><X size={17}/></button></div>
  <div className="twun-welcome-content">
   <div className="twun-welcome-brand"><div><span className="twun-brand-mark" aria-hidden="true"><img src="/label.png" width="1254" height="1254" alt=""/></span><span>TWUN</span></div><span className="twun-welcome-stamp">STOCK PERFORMANCE<br/><b>PAIRED.</b></span></div>
   <h2 id="twun-welcome-title" ref={title} tabIndex={-1}>YOUR TAKE.<br/><span>YOUR PAIR.</span></h2>
   <p id="twun-welcome-description">Go long or short on one stock against another. Explore a different way to trade stock performance.</p>
   <div className="twun-welcome-points">
    <div><span>01</span><div><h3>50 stocks. Any two.</h3><p>Build your pair and trade its price ratio. No share ownership.</p></div></div>
    <div><span>02</span><div><h3>Long or Short. Your perspective.</h3><p>Express which stock will outperform, with isolated margin and 1–10× leverage.</p></div></div>
    <div><span>03</span><div><h3>The whole position, in one view.</h3><p>Follow the ratio, PnL, funding and liquidation level from one terminal.</p></div></div>
   </div>
   <div className="twun-welcome-status"><strong>CURRENT RELEASE · DEMO PREVIEW</strong><p>Trading is currently simulated. Live trading is not available yet.</p></div>
   <div className="twun-welcome-actions"><button type="button" onClick={()=>{dismiss();router.push("/trade");}}>Explore the terminal <ArrowUpRight size={17}/></button><button type="button" onClick={dismiss}>Look around first</button></div>
   <p className="twun-welcome-note">Preview balances and positions are saved in this browser.</p>
  </div>
 </dialog>;
}
