"use client";
import { useDemo } from "./demo-store";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
export function PerpsNotice({ dismissible = false }: { dismissible?: boolean }) {
  const { legacyPresent, storageWarning } = useDemo();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { try { setDismissed(localStorage.getItem("pair-archive-notice-dismissed") === "true"); } catch { /* Session-only dismissal. */ } }, []);
  if (dismissible) return <>{legacyPresent && !dismissed && <div className="odado-archive-notice"><p><strong>A fresh start.</strong> Your synthetic v2 account is archived separately. Previous positions are not repriced.</p><button aria-label="Dismiss archive notice" onClick={() => { setDismissed(true); try { localStorage.setItem("pair-archive-notice-dismissed", "true"); } catch { /* No account data is changed. */ } }}><X size={17}/></button></div>}{storageWarning && <p role="alert" className="odado-feed-alert">{storageWarning}</p>}</>;
  return <><p className="mb-4 border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-[11px] leading-relaxed text-[#5b534c]">New real-data demo account · 10,000 simulated USDC. {legacyPresent ? "Your synthetic v2 account is archived separately; previous positions are not repriced." : "Separate from the previous synthetic demo and real wallet funds."} Execution, funding and liquidation remain simulated.</p>{storageWarning && <p role="alert" className="mb-4 border border-[var(--line)] p-3 text-xs">{storageWarning}</p>}</>;
}
