"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleDollarSign, Layers3, MousePointer2 } from "lucide-react";
import { LaunchLink } from "@/components/site-nav";
import { HeroVisual } from "@/components/hero-visual";
import { TerminalPreview } from "@/components/terminal-preview";
import { InteractiveExample } from "@/components/interactive-example";
import { PerpsMarketCards } from "@/components/perps-market-cards";

const faqs = [
  ["What is Odado?", "Odado lets you build synthetic ratio markets from a curated catalog of 50 large US stocks across 11 sectors. Choose Long or Short with 1–10x leverage and isolated demo USDC margin."],
  ["Am I buying company shares?", "No. This is synthetic exposure to the ratio of two stock prices. It does not exchange stock tokens or create ownership of company shares."],
  ["Is this real trading?", "No. Underlying stock prices come from Twelve Data when configured. Margin, funding and execution are simulated locally. Wallet connection is real, but demo positions never request signatures or transactions."],
  ["How do PnL and liquidation work?", "Long PnL rises with the ratio; Short profits from its decline. Fees and funding are separate. Liquidation occurs when isolated equity falls to 5% of entry notional. Read the demo model in the terminal for the full formulas."],
];

export default function Home() {
  return <main className="odado-home">
    <section aria-label="Odado introduction" className="odado-home-hero">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
        <div className="slide-up max-w-[560px]">
          <p className="odado-kicker mb-6">Ratio perpetuals · Solana wallets</p>
          <h1 aria-label="Trade stock performance. No tokenization required." className="text-[clamp(44px,5.3vw,74px)] font-extrabold leading-[1.02] tracking-[-.05em]"><span className="block">Trade stock</span><span className="block">performance.</span><span className="mt-5 block text-[clamp(28px,3.2vw,44px)] leading-[1.1] text-[#82776c]">No tokenization<br/>required.</span></h1>
          <p className="mt-6 max-w-[370px] text-[17px] leading-[1.65] text-[#5b534c]">Go long or short on one stock against another, with USDC collateral.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3"><Link href="/trade" className="odado-primary-link">Launch app <ArrowUpRight size={15}/></Link><span className="rounded-full border border-[#a99f93] px-3 py-1 text-[11px] font-semibold text-[#5b534c]">Demo</span><a href="#how-it-works" className="inline-flex items-center gap-1.5 py-2 text-xs font-semibold text-[#5b534c] hover:text-[var(--ink)]">How it works <ArrowDownRight size={15}/></a></div>
        </div>
        <HeroVisual />
      </div>
    </section>

    <PerpsMarketCards />

    <section id="how-it-works" className="px-5 py-20 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]"><div className="mx-auto max-w-[1200px]"><div className="mb-10 grid gap-5 md:grid-cols-2"><div><p className="eyebrow mb-2">02 / The mechanic</p><h2 className="text-4xl font-extrabold tracking-[-.08em]">A ratio is the market.</h2></div><p className="max-w-md self-end text-sm leading-relaxed opacity-70">Choose any two different stocks. Their price ratio is the index. Synthetic exposure, without owning shares. Demo positions settle in USDC; outside regular hours, at the last validated prices.</p></div>
        <div className="grid border-y border-[var(--line)] md:grid-cols-3">
          {[["01","Build your pair",<MousePointer2 key="i"/> ,"Pick two stocks from 50. Long for a rising ratio. Short for a falling one."],["02","Set your margin",<Layers3 key="i"/>,"Choose isolated demo USDC collateral and leverage from 1x to 10x."],["03","Manage the position",<CircleDollarSign key="i"/>,"Track PnL, funding and liquidation. Close to settle back into demo USDC."]].map(([num,title,icon,body]) => <div key={String(num)} className="border-[var(--line)] py-7 pr-8 md:border-r md:px-7 first:pl-0 last:border-0"><div className="mb-10 flex items-start justify-between mono text-xs"><span>{num}</span>{icon as React.ReactNode}</div><h3 className="text-xl font-extrabold tracking-[-.06em]">{title as string}</h3><p className="mt-3 max-w-xs text-xs leading-relaxed opacity-65">{body as string}</p></div>)}
        </div>
      </div></section>

    <InteractiveExample />
    <section className="odado-home-preview"><div className="mx-auto max-w-[1200px]"><div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-2 text-[#7c7670]">03 / See it clearly</p><h2 className="text-4xl font-extrabold tracking-[-.08em]">The terminal, reduced<br/>to the essential.</h2></div><LaunchLink label="Open demo terminal"/></div>
        <TerminalPreview />
      </div></section>

    <section className="px-5 py-20 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]"><div className="mx-auto max-w-[1200px]"><div className="mb-9"><p className="eyebrow mb-2">04 / Good questions</p><h2 className="text-4xl font-extrabold tracking-[-.08em]">No fine print in the dark.</h2></div><div className="border-y border-[var(--line)]">{faqs.map(([question,answer], index) => <details key={question} className="group border-b border-[var(--line)] last:border-0"><summary className="flex cursor-pointer list-none items-center justify-between py-5 text-sm font-extrabold">{String(index + 1).padStart(2,"0")} · {question}<ChevronDown size={17} className="transition group-open:rotate-180"/></summary><p className="max-w-2xl pb-5 pl-7 text-xs leading-relaxed opacity-65">{answer}</p></details>)}</div></div></section>
    <footer className="odado-home-footer"><div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-8 sm:flex-row"><div><p className="text-2xl font-extrabold tracking-[-.09em]">Odado</p><p className="mt-2 max-w-sm text-[10px] leading-relaxed text-[#7c7670]">A demonstration of perpetual futures on a stock price ratio. Isolated demo USDC margin. Twelve Data underlying-stock index, not a live perpetual quote. No live trading, transactions or share ownership.</p></div><div className="flex gap-8 text-xs font-bold text-[#7c7670]"><Link href="/trade">Demo terminal</Link><Link href="/portfolio">Demo portfolio</Link><a href="#how-it-works">Mechanics</a></div></div></footer>
  </main>;
}
