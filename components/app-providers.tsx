"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { DemoProvider } from "@/components/demo-store";
import { MarketProvider } from "@/components/market-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const endpoint = clusterApiUrl("mainnet-beta");
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet })], []);
  return <ConnectionProvider endpoint={endpoint}><WalletProvider wallets={wallets} autoConnect={false}><MarketProvider><DemoProvider>{children}</DemoProvider></MarketProvider></WalletProvider></ConnectionProvider>;
}
