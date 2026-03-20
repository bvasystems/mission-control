"use client";

import React, { useRef, useState } from "react";
import { Zap, ChevronDown, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const TARGETS = [
  { id: "all",     label: "ALL AGENTS" },
  { id: "faisca",  label: "Faísca" },
  { id: "caio",    label: "Caio" },
  { id: "leticia", label: "Letícia" },
  { id: "faisca",  label: "Faísca" },
  { id: "clara",   label: "Clara" },
];

export function NeuralPulse() {
  const [command, setCommand] = useState("");
  const [target, setTarget] = useState(TARGETS[0]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    if (!command.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/dashboard/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: command.trim(),
          category: "command",
          source: "neural_pulse",
          target: target.id,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("sent");
      setCommand("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="w-full bg-[#0d0d16] border-t border-white/[0.07] px-4 py-3 shrink-0 relative">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      <div className="max-w-4xl mx-auto flex items-center gap-3">
        {/* Lightning icon */}
        <Zap size={18} className="text-blue-500 shrink-0" />

        {/* Target selector */}
        <div className="relative shrink-0" ref={dropRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-2 h-10 whitespace-nowrap"
          >
            {target.label}
            <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 min-w-[140px]">
              {TARGETS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTarget(t); setOpen(false); inputRef.current?.focus(); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                    t.id === target.id
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Command input */}
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Pulse de comando para os agentes... (Enter para enviar)"
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none font-mono h-10"
          disabled={status === "sending"}
        />

        {/* Status / Send button */}
        {status === "sending" && <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />}
        {status === "sent" && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 shrink-0 animate-in fade-in">
            <CheckCircle2 size={14} /> Pulse enviado para {target.label}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-1 text-[11px] text-red-400 shrink-0">
            <AlertCircle size={14} /> Falha
          </div>
        )}
        {status === "idle" && (
          <button
            onClick={send}
            disabled={!command.trim()}
            className="shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-[0_0_20px_rgba(59,130,246,0.35)] h-10"
          >
            <Send size={13} /> Send Pulse
          </button>
        )}
      </div>
    </div>
  );
}
