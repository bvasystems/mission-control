"use client";

import { useEffect } from "react";
import { OfficeCanvas } from "@/features/office/components/OfficeCanvas";
import { SidePanel } from "@/features/office/components/SidePanel";
import { useOfficeStore } from "@/features/office/store";
import { useAgents, useIncidents } from "@/features/office/hooks/useOfficeData";
import {
  Building2, Wifi, WifiOff, AlertTriangle, Users, Zap,
  Keyboard, Mouse, MonitorUp,
} from "lucide-react";

// ── Status Bar ────────────────────────────────────────────────────────────────

function OfficeStatusBar() {
  const { data: agents } = useAgents();
  const { data: incidents } = useIncidents();

  const active = agents?.filter((a) => a.status === "active").length ?? 0;
  const total = agents?.length ?? 0;
  const degraded = agents?.filter((a) => a.status === "degraded").length ?? 0;
  const down = agents?.filter((a) => a.status === "down").length ?? 0;
  const openIncidents = incidents?.filter((i) => i.status !== "closed").length ?? 0;
  const isConnected = !!agents;

  return (
    <div className="relative flex items-center justify-between px-6 py-2.5 shrink-0 z-10">
      {/* Glass background */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-900/60 to-zinc-950/80 backdrop-blur-md border-b border-white/[0.06]" />

      {/* Left: Brand */}
      <div className="relative flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20">
          <Building2 size={14} className="text-indigo-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white tracking-tight">Virtual Office</span>
          <span className="text-[10px] text-zinc-600 font-medium tracking-widest uppercase">Mission Control</span>
        </div>
      </div>

      {/* Right: Status indicators */}
      <div className="relative flex items-center gap-3">
        {/* Agents summary */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
          <Users size={11} className="text-zinc-500" />
          <span className="text-[11px] text-zinc-400 font-medium">{active}<span className="text-zinc-600">/{total}</span></span>
          {active > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
        </div>

        {/* Degraded/Down */}
        {degraded > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/[0.06] border border-yellow-500/10">
            <Zap size={11} className="text-yellow-500" />
            <span className="text-[11px] text-yellow-400 font-medium">{degraded}</span>
          </div>
        )}
        {down > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/[0.06] border border-red-500/10">
            <AlertTriangle size={11} className="text-red-500" />
            <span className="text-[11px] text-red-400 font-medium">{down}</span>
          </div>
        )}

        {/* Incidents */}
        {openIncidents > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/[0.06] border border-red-500/10">
            <AlertTriangle size={11} className="text-red-400" />
            <span className="text-[11px] text-red-400 font-medium">{openIncidents}</span>
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.08]" />

        {/* Connection */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
          isConnected
            ? "bg-emerald-500/[0.06] border border-emerald-500/10"
            : "bg-red-500/[0.06] border border-red-500/10"
        }`}>
          {isConnected ? (
            <>
              <Wifi size={11} className="text-emerald-500" />
              <span className="text-[11px] text-emerald-400 font-medium">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={11} className="text-red-500" />
              <span className="text-[11px] text-red-400 font-medium">Offline</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Help Bar ──────────────────────────────────────────────────────────────────

function OfficeHelpBar() {
  const activePanel = useOfficeStore((s) => s.activePanel);

  return (
    <div className="relative flex items-center justify-center px-6 py-1.5 shrink-0 z-10">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm border-t border-white/[0.04]" />

      <div className="relative flex items-center gap-5 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Keyboard size={10} className="text-zinc-600" />
          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-zinc-400 font-mono text-[9px]">WASD</kbd>
          mover
        </span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1.5">
          <Mouse size={10} className="text-zinc-600" />
          Clique em <strong className="text-zinc-400">agente</strong> ou <strong className="text-zinc-400">sala</strong>
        </span>
        {activePanel && (
          <>
            <span className="text-zinc-700">|</span>
            <span className="flex items-center gap-1.5">
              <MonitorUp size={10} className="text-zinc-600" />
              <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-zinc-400 font-mono text-[9px]">ESC</kbd>
              fechar painel
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const closePanel = useOfficeStore((s) => s.closePanel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closePanel]);

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      <OfficeStatusBar />
      <OfficeCanvas />
      <OfficeHelpBar />
      <SidePanel />
    </div>
  );
}
