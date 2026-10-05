"use client";

import { DemoProvider } from "@/components/demo-store";
import { MarketProvider } from "@/components/market-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <MarketProvider><DemoProvider>{children}</DemoProvider></MarketProvider>;
}
