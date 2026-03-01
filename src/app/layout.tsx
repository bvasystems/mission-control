import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SessionProviderClient from "@/components/SessionProviderClient";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mission Control | BVA",
  description: "Painel operacional e comando centralizado",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500/30`}>
        <SessionProviderClient>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-white/[0.08] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/15 via-zinc-950 to-zinc-950">
              {children}
            </div>
          </div>
        </SessionProviderClient>
      </body>
    </html>
  );
}
