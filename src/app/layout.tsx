import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
title: "Mission Control",
description: "Painel operacional de agentes",
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html lang="pt-BR">
<body className="bg-zinc-950 text-zinc-100">
<div className="min-h-screen flex">
<Sidebar />
<div className="flex-1">{children}</div>
</div>
</body>
</html>
);
}
