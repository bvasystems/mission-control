import React, { useState } from "react";
import { Terminal, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function CommandBar() {
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      // Parse @mentions
      const mentions = command.match(/@[\wÀ-ÿ]+/g) || [];
      const assigned_to = mentions.map(m => m.substring(1)).join(",") || undefined;
      
      const title = command.replace(/@[\wÀ-ÿ]+/g, "").trim();

      const res = await fetch("/api/dashboard/task-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Tarefa Despachada via CommandBar",
          assigned_to,
          priority: command.toLowerCase().includes("urgente") ? "high" : "medium"
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Erro ${res.status}`);
      }

      setStatus("success");
      setCommand("");

      setTimeout(() => setStatus("idle"), 3000);
    } catch (error: unknown) {
      console.error("Failed to dispatch task", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao despachar tarefa");
      
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="w-full bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/50 p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
      <form onSubmit={handleSubmit} className="max-w-[1400px] mx-auto relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-emerald-500">
          <Terminal size={18} />
        </div>
        
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Despachar tarefa... @caio @leticia @clara (adicione 'urgente' para prioridade alta)"
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 block pl-12 pr-24 py-4 shadow-inner placeholder:text-zinc-500 font-mono transition-shadow h-14"
          disabled={status === "submitting"}
          autoComplete="off"
          spellCheck="false"
        />

        <div className="absolute inset-y-0 right-2 flex items-center pr-2">
          {status === "submitting" ? (
            <Loader2 className="animate-spin text-emerald-500" size={20} />
          ) : status === "success" ? (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md font-medium text-xs border border-emerald-500/20">
              <CheckCircle2 size={16} /> Enviado
            </div>
          ) : status === "error" ? (
            <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-md font-medium text-xs border border-rose-500/20 max-w-[150px] truncate" title={errorMessage}>
              <AlertCircle size={16} /> Falhou
            </div>
          ) : (
            <button
              type="submit"
              disabled={!command.trim()}
              className="p-2 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        
        {/* Glow effect for input */}
        <div className="absolute -inset-0.5 bg-emerald-500/0 group-focus-within:bg-emerald-500/10 rounded-xl blur-md -z-10 transition-colors pointer-events-none"></div>
      </form>
    </div>
  );
}
