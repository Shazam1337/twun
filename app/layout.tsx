import "./markets.css";
import type { Metadata } from "next";
import "./globals.css";
import "./odado.css";
import "./twun.css";
import { SiteNav } from "@/components/site-nav";
import { AppProviders } from "@/components/app-providers";

export const metadata: Metadata = {
  title: "TWUN — Trade stock performance.",
  icons: { icon: { url: "/label.png", type: "image/png" } },
  description: "Build a pair from 50 US stocks with Long/Short perpetual futures, isolated demo USDC margin and up to 10x leverage.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="odado twun">
        <AppProviders><SiteNav/>{children}</AppProviders>
      </body>
    </html>
  );
}
