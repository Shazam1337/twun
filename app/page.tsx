"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleDollarSign, Layers3, MousePointer2 } from "lucide-react";
import { TwunHero } from "@/components/twun-hero";
import { StockTicker } from "@/components/stock-ticker";
import { PerpsMarketCards } from "@/components/perps-market-cards";

const faqs = [
  ["What is TWUN?", "TWUN is a platform for trading the relative performance of two stocks through synthetic ratio markets. Build your pair from 50 US stocks across 11 sectors, choose Long or Short, and manage isolated margin from one terminal. The current release is a demo preview."],
  ["Am I buying company shares?", "No. This is synthetic exposure to the ratio of two stock prices. It does not exchange stock tokens or create ownership of company shares."],
  ["Can I trade with real funds?", "Live trading is not available yet. The current release uses demo USDC and simulated execution while TWUN is developed toward real trading. Underlying prices come from Twelve Data when configured. Connecting a wallet does not deposit funds or authorize trades."],
  ["How do PnL and liquidation work?", "Long PnL rises with the ratio; Short profits from its decline. Fees and funding are separate. Liquidation occurs when isolated equity falls to 5% of entry notional. Read the demo model in the terminal for the full formulas."],
];

export default function Home() {
  return <main className="odado-home">
    <section aria-label="TWUN introduction" className="odado-home-hero">
      <div className="twun-hero-grid">
        <div className="twun-hero-copy">
          <p className="twun-sticker">Built for relative performance</p>
          <h1 aria-label="Trade stock performance. No tokenization required." className="twun-hero-title"><span>Trade stock</span><span>performance.</span><em>No tokenization<br/>required.</em></h1>
          <p className="twun-hero-description">Go long or short on one stock against another, with USDC collateral. Your perspective. One ratio.</p>
          <div className="twun-hero-actions"><Link href="/trade" className="odado-primary-link">Launch terminal <ArrowUpRight size={16}/></Link><a href="#how-it-works" className="twun-secondary-link">How it works ↓</a></div>
          <p className="twun-release-status"><span className="twun-demo-badge">DEMO PREVIEW</span><span>Live trading is not available yet.</span></p>
          <div className="twun-hero-notes"><span>Real market data</span><span>No stock ownership</span></div>
        </div>
        <TwunHero/>
      </div>
    </section>

    <StockTicker />
    <PerpsMarketCards />

    <section id="how-it-works" className="px-5 py-20 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]"><div className="mx-auto max-w-[1200px]"><div className="mb-10 grid gap-5 md:grid-cols-2"><div><p className="eyebrow mb-2">02 / The mechanic</p><h2 className="text-4xl font-extrabold tracking-[-.08em]">A ratio is the market.</h2></div><p className="max-w-md self-end text-sm leading-relaxed opacity-70">Choose two stocks and take a view on their relative performance. Their price ratio is the index. Long for a rise, Short for a fall, with USDC margin and no share ownership.</p></div>
        <div className="grid border-y border-[var(--line)] md:grid-cols-3">
          {[["01","Build your pair",<MousePointer2 key="i"/> ,"Pick two stocks from 50. Long for a rising ratio. Short for a falling one."],["02","Set your margin",<Layers3 key="i"/>,"Choose isolated USDC margin and leverage from 1x to 10x."],["03","Manage the position",<CircleDollarSign key="i"/>,"See PnL, funding and liquidation together. Stay in control of your position."]].map(([num,title,icon,body]) => <div key={String(num)} className="border-[var(--line)] py-7 pr-8 md:border-r md:px-7 first:pl-0 last:border-0"><div className="mb-10 flex items-start justify-between mono text-xs"><span>{num}</span>{icon as React.ReactNode}</div><h3 className="text-xl font-extrabold tracking-[-.06em]">{title as string}</h3><p className="mt-3 max-w-xs text-xs leading-relaxed opacity-65">{body as string}</p></div>)}
        </div>
      </div></section>

    <section className="px-5 py-20 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]"><div className="mx-auto max-w-[1200px]"><div className="mb-9"><p className="eyebrow mb-2">03 / Good questions</p><h2 className="text-4xl font-extrabold tracking-[-.08em]">No fine print in the dark.</h2></div><div className="border-y border-[var(--line)]">{faqs.map(([question,answer], index) => <details key={question} className="group border-b border-[var(--line)] last:border-0"><summary className="flex cursor-pointer list-none items-center justify-between py-5 text-sm font-extrabold">{String(index + 1).padStart(2,"0")} · {question}<ChevronDown size={17} className="transition group-open:rotate-180"/></summary><p className="max-w-2xl pb-5 pl-7 text-xs leading-relaxed opacity-65">{answer}</p></details>)}</div></div></section>
    <footer className="odado-home-footer"><div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-8 sm:flex-row"><div><p className="text-2xl font-extrabold tracking-[-.09em]">TWUN</p><p className="mt-2 max-w-sm text-[10px] leading-relaxed text-[#7c7670]">A platform for trading stock performance through synthetic ratio markets. Current release: demo preview. Live execution is not available yet. Twelve Data supplies the underlying-stock index. No share ownership.</p></div><div className="flex gap-8 text-xs font-bold text-[#7c7670]"><Link href="/trade">Terminal</Link><Link href="/portfolio">Portfolio</Link><a href="#how-it-works">Mechanics</a></div></div></footer>
  </main>;
}
