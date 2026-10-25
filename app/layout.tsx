import "./markets.css";
import type { Metadata } from "next";
import "./globals.css";
import "./odado.css";
import "./twun.css";
import "./chart-tools.css";
import "./contract-badge.css";
import "./side-notes.css";
import "./news.css";
import "./feedback.css";
import "./analytics.css";
import { SiteNav } from "@/components/site-nav";
import { AppProviders } from "@/components/app-providers";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { SideNotes } from "@/components/side-notes";

export const metadata: Metadata = {
  title: "TWUN — Trade stock performance.",
  icons: { icon: { url: "/label.png", type: "image/png" } },
  description: "Trade the relative performance of two stocks. Build a pair from 50 US stocks, go Long or Short, and manage isolated USDC margin. Currently available as a demo preview.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="odado twun">
        <AppProviders><SiteNav/>{children}<SideNotes/><WelcomeDialog/></AppProviders>
      </body>
    </html>
  );
}
