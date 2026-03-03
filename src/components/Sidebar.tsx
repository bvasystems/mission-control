"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import { LayoutDashboard, KanbanSquare, TriangleAlert, Clock, Bot, FolderKanban, Activity } from "lucide-react";

const items = [
  { href: "/",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects",  icon: FolderKanban },
  { href: "/kanban",   label: "Kanban",    icon: KanbanSquare },
  { href: "/incidents",label: "Incidents", icon: TriangleAlert },
  { href: "/crons",    label: "Crons",     icon: Clock },
  { href: "/agents",   label: "Agents",    icon: Bot },
  { href: "/canvas",   label: "Canvas",    icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-14 h-full border-r border-white/10 bg-zinc-950/60 backdrop-blur-xl hidden md:flex md:flex-col relative z-20 shrink-0 group/sidebar hover:w-56 transition-all duration-200 ease-in-out overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Brand — icon only by default, text on hover */}
      <div className="px-3 py-5 flex items-center gap-3 overflow-hidden shrink-0">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </div>
        <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden">
          <p className="text-[9px] uppercase tracking-[0.2em] text-blue-400 font-semibold leading-none mb-0.5">Mission Control</p>
          <p className="text-sm font-medium text-white leading-none">BVA Systems</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pb-4 space-y-1 overflow-hidden">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all duration-200 relative overflow-hidden ${
                active
                  ? "text-blue-300 bg-blue-500/10 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
              }`}
            >
              {active && <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
              <Icon size={18} className={`shrink-0 ${active ? "text-blue-400" : "opacity-80"}`} />
              <span className="font-medium whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className="shrink-0 px-2 py-3 border-t border-white/10 bg-black/40 overflow-hidden">
        <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-2 px-2 font-medium">Operator</p>
        </div>
        <AuthButton collapsed />
      </div>
    </aside>
  );
}
