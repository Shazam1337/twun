"use client";
import { useState } from "react";
import { useDemo } from "./demo-store";
import { useMarket } from "./market-store";
export function DemoMarket() {
  const { advance } = useDemo(); const { canTrade, pair, feed } = useMarket();
  const [message, setMessage] = useState("");
  return <section className="border-t border-[var(--line)] bg-[var(--paper)] p-4" aria-label="Simulated funding controls"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Model funding</p><p className="mt-1 text-[11px] leading-relaxed text-[#686057]">Selected pair: {pair.base}/{pair.quote}. +0.01% / 8h. No real funding feed.<br/>Outside the session funding is paused. No overnight accrual or catch-up.</p></div><button disabled={!canTrade || feed?.session.state !== "open"} onClick={() => { const r = advance(); setMessage(r.ok ? r.message : r.error); }} className="shrink-0 border border-[var(--line)] px-3 py-2 text-[11px] font-bold disabled:opacity-40">Advance 8h</button></div>{message && <p role="status" className="mt-3 text-xs">{message}</p>}</section>;
}
