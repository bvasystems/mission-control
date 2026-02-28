"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import { LayoutDashboard, KanbanSquare, TriangleAlert, Clock, Bot } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/incidents", label: "Incidents", icon: TriangleAlert },
  { href: "/crons", label: "Crons", icon: Clock },
  { href: "/agents", label: "Agents", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/10 bg-zinc-950/60 backdrop-blur-xl hidden md:flex md:flex-col relative z-20">
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

      {/* Top */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold">Mission Control</p>
        </div>
        <h1 className="text-xl font-medium tracking-tight text-white">BVA Systems</h1>
      </div>

      {/* Nav */}
      <nav className="px-4 pb-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 relative overflow-hidden ${
                active
                  ? "text-blue-300 bg-blue-500/10 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
              }`}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              )}
              <Icon size={18} className={active ? "text-blue-400" : "opacity-80"} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="p-4 border-t border-white/10 bg-zinc-900/40">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3 px-2 font-medium">Operator Session</p>
        <AuthButton />
      </div>
    </aside>
  );
}
