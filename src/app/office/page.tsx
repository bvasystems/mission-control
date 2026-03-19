"use client";

import { useEffect } from "react";
import { OfficeCanvas } from "@/features/office/components/OfficeCanvas";
import { SidePanel } from "@/features/office/components/SidePanel";
import { useOfficeStore } from "@/features/office/store";
import { useAgents, useIncidents } from "@/features/office/hooks/useOfficeData";
import { Building2, Wifi, WifiOff, AlertTriangle } from "lucide-react";

function OfficeStatusBar() {
  const { data: agents } = useAgents();
  const { data: incidents } = useIncidents();

  const active = agents?.filter((a) => a.status === "active").length ?? 0;
  const degraded = agents?.filter((a) => a.status === "degraded").length ?? 0;
  const down = agents?.filter((a) => a.status === "down").length ?? 0;
  const openIncidents = incidents?.filter((i) => i.status !== "closed").length ?? 0;
  const isConnected = !!agents;

  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06] bg-black/30 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <Building2 size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-white">Virtual Office</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Mission Control</span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Agent status pills */}
        <div className="flex items-center gap-2">
          {active > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {active}
            </span>
          )}
          {degraded > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              {degraded}
            </span>
          )}
          {down > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {down}
            </span>
          )}
        </div>

        {/* Incidents */}
        {openIncidents > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle size={12} />
            {openIncidents} incidente{openIncidents > 1 ? "s" : ""}
          </span>
        )}

        {/* Connection */}
        <span className={`flex items-center gap-1 ${isConnected ? "text-green-500" : "text-red-500"}`}>
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>
    </div>
  );
}

function OfficeHelpBar() {
  const activePanel = useOfficeStore((s) => s.activePanel);

  return (
    <div className="flex items-center justify-center px-5 py-1.5 border-t border-white/[0.04] bg-black/20 text-[10px] text-zinc-600 gap-6 shrink-0">
      <span>Clique em uma <strong className="text-zinc-500">sala</strong> ou <strong className="text-zinc-500">agente</strong> para abrir detalhes</span>
      {activePanel && <span>Pressione <kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-500">ESC</kbd> para fechar painel</span>}
    </div>
  );
}

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
