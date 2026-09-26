"use client";

import { RotateCcw } from "lucide-react";
import { useDemo } from "@/components/demo-store";

export function ResetDemo() {
  const { reset } = useDemo();
  const confirmReset = () => { if (window.confirm("Reset only the real-data demo to 10,000 USDC and clear its positions and activity? Archived synthetic v2 and old spot accounts are preserved.")) reset(); };
  return <button onClick={confirmReset} className="inline-flex h-10 items-center gap-2 border border-[var(--line)] px-3 text-xs font-bold transition hover:bg-[var(--paper)]"><RotateCcw size={14}/> Reset demo</button>;
}
