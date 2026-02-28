"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";

const items = [
{ href: "/", label: "Dashboard" },
{ href: "/kanban", label: "Kanban" },
{ href: "/incidents", label: "Incidents" },
{ href: "/crons", label: "Crons" },
{ href: "/agents", label: "Agents" },
];

export default function Sidebar() {
const pathname = usePathname();

return (
<aside className="w-64 border-r border-zinc-800 bg-zinc-950/80 hidden md:flex md:flex-col">
{/* Top */}
<div className="p-4">
<p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Mission Control</p>
<h1 className="text-lg font-semibold">BVA Systems</h1>
</div>

{/* Nav */}
<nav className="px-4 pb-4 space-y-1">
{items.map((item) => {
const active = pathname === item.href;
return (
<Link
key={item.href}
href={item.href}
className={`block rounded-xl px-3 py-2 text-sm transition ${
active
? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
: "text-zinc-300 hover:bg-zinc-900 border border-transparent"
}`}
>
{item.label}
</Link>
);
})}
</nav>

<div className="flex-1" />

{/* Bottom */}
<div className="p-4 border-t border-zinc-800">
<p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Sessão</p>
<AuthButton />
</div>
</aside>
);
}
