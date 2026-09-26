"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Copy, ExternalLink, Wallet, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName, WalletReadyState } from "@solana/wallet-adapter-base";

function shortAddress(address: string) { return `${address.slice(0, 4)}…${address.slice(-4)}`; }

export function WalletControl({ compact = false, rounded = false }: { compact?: boolean; rounded?: boolean }) {
  const { wallets, select, wallet, publicKey, connected, connecting, connect, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState<WalletName | null>(null);
  const [notice, setNotice] = useState("");
  const [installUrl, setInstallUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pendingConnect && wallet?.adapter.name === pendingConnect && !connected) {
      setPendingConnect(null);
      connect().then(() => setIsOpen(false)).catch(() => {
        setNotice("Connection was not completed. Unlock your wallet and try again, or continue the demo without one.");
        setIsOpen(true);
      });
    }
  }, [wallet, pendingConnect, connected, connect]);

  const choose = (name: WalletName) => {
    setNotice("");
    setInstallUrl(null);
    const selected = wallets.find(({ adapter }) => adapter.name === name);
    if (!selected || selected.readyState !== WalletReadyState.Installed) {
      setNotice(`${name} extension was not detected. Install it, refresh this page, then connect. The demo works without a wallet.`);
      setInstallUrl(name === "Phantom" ? "https://phantom.com/download" : "https://www.solflare.com/download/");
      return;
    }
    select(name);
    setPendingConnect(name);
  };

  if (connected && publicKey) {
    return <div className="relative">
      <button onClick={() => setIsOpen((open) => !open)} className={`inline-flex h-10 items-center gap-2 border border-[var(--line)] bg-[var(--milk)] px-3 text-xs font-bold hover:bg-[var(--taupe)] ${rounded ? "rounded-full" : ""}`}>
        <span className="h-2 w-2 rounded-full bg-[var(--green)]" /> {shortAddress(publicKey.toBase58())}<ChevronDown size={14} />
      </button>
      {isOpen && <div className="absolute right-0 z-50 mt-2 w-64 border border-[var(--line)] bg-[var(--milk)] p-3 shadow-xl">
        <p className="eyebrow mb-2 opacity-60">{wallet?.adapter.name} connected</p>
        <p className="mono break-all text-xs">{publicKey.toBase58()}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => navigator.clipboard.writeText(publicKey.toBase58())} className="flex flex-1 items-center justify-center gap-1 border border-[var(--line)] py-2 text-xs font-bold"><Copy size={12} /> Copy</button>
          <button onClick={() => { void disconnect().then(() => setIsOpen(false)); }} className="flex flex-1 items-center justify-center gap-1 bg-[var(--ink)] py-2 text-xs font-bold text-[var(--milk)]"><X size={12} /> Disconnect</button>
        </div>
      </div>}
    </div>;
  }

  return <div className="relative">
    <button onClick={() => { setNotice(""); setIsOpen(true); }} className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-[var(--ink)] ${compact ? "px-3" : "px-4"} ${rounded ? "rounded-full" : ""} text-xs font-bold text-[var(--milk)] transition hover:bg-black`}>
      <Wallet size={14} /> {connecting ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
    </button>
    {isOpen && <div role="dialog" aria-label="Connect a Solana wallet" className="absolute right-0 z-50 mt-2 w-72 border border-[var(--line)] bg-[var(--milk)] p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between"><div><p className="text-sm font-extrabold">Connect a Solana wallet</p><p className="mt-1 text-[10px] leading-relaxed opacity-60">Wallet connection is real. Demo positions never request a signature.</p></div><button aria-label="Close wallet menu" onClick={() => setIsOpen(false)}><X size={16} /></button></div>
      {wallets.map(({ adapter }) => (
        <button disabled={connecting} key={adapter.name} onClick={() => choose(adapter.name)} className="mb-2 flex w-full items-center justify-between border border-[var(--line)] p-3 text-left transition hover:bg-[var(--taupe)]">
          <span className="flex items-center gap-2 text-sm font-bold"><img src={adapter.icon} alt="" className="h-5 w-5" />{adapter.name}</span><ExternalLink size={13} className="opacity-50" />
        </button>
      ))}
      {notice && <p role="status" className="mt-2 text-[11px] leading-relaxed">{notice}</p>}
      {installUrl && <a href={installUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold underline">Get the extension <ExternalLink size={12}/></a>}
    </div>}
  </div>;
}
