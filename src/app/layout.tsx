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
      <body className={`${inter.className} bg-black text-zinc-300 antialiased selection:bg-indigo-500/30`}>
        <SessionProviderClient>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 overflow-x-hidden border-l border-white/[0.05] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black">
              {children}
            </div>
          </div>
        </SessionProviderClient>
      </body>
    </html>
  );
}
