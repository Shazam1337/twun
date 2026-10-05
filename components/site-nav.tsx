"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { WalletControl } from "./wallet-control";

export function SiteNav() {
  const pathname = usePathname();
  return <><div className="twun-ticker" aria-label="Real prices. Demo execution. Robinhood Chain."><div>{["REAL PRICES. REAL PERSPECTIVE.","DEMO EXECUTION ONLY","50 STOCKS. ANY TWO.","ROBINHOOD CHAIN","NO TOKENIZATION REQUIRED","REAL PRICES. REAL PERSPECTIVE.","DEMO EXECUTION ONLY"].map((text,i)=><span key={i}><i/>{text}</span>)}</div></div><header className="odado-header">
    <Link href="/" className="odado-brand" aria-label="TWUN home"><span className="twun-brand-mark" aria-hidden="true"><img src="/label.png" width="1254" height="1254" alt=""/></span><span>TWUN</span></Link>
    <nav aria-label="Main navigation" className="odado-nav">{[{ href: "/", label: "Overview" }, { href: "/trade", label: "Trade" }, { href: "/portfolio", label: "Portfolio" }].map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
    <div className="odado-header-end"><span className="odado-demo-label"><span/>Real prices · Demo trading</span><span className="odado-network">Robinhood</span><WalletControl rounded/><a href="https://x.com/twun_live" target="_blank" rel="noopener noreferrer" className="odado-x-link" aria-label="X (Twitter)" title="@twun_live on X"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933ZM17.61 20.644h2.039L6.486 3.24H4.298L17.61 20.644Z"/></svg></a></div>
  </header></>;
}
export function LaunchLink({ label = "Launch app" }: { label?: string }) {
  return <Link href="/trade" className="odado-primary-link">{label}<ArrowUpRight size={16}/></Link>;
}
