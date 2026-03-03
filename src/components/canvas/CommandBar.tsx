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
    <div className="w-full bg-black/40 backdrop-blur-md border-t border-white/[0.08] p-5 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] z-20 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-blue-500/20 blur-[10px] rounded-full pointer-events-none"></div>
      
      <form onSubmit={handleSubmit} className="max-w-[1400px] mx-auto relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-blue-500">
          <Terminal size={18} />
        </div>
        
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Despachar tarefa... @caio @leticia @clara (adicione 'urgente' para prioridade alta)"
          className="w-full bg-black/60 border border-white/10 text-zinc-100 text-sm rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 block pl-12 pr-24 py-4 shadow-inner placeholder:text-zinc-600 font-mono transition-all h-14"
          disabled={status === "submitting"}
          autoComplete="off"
          spellCheck="false"
        />

        <div className="absolute inset-y-0 right-2 flex items-center pr-1.5">
          {status === "submitting" ? (
            <Loader2 className="animate-spin text-blue-500 mr-2" size={20} />
          ) : status === "success" ? (
            <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-4 py-2 rounded-lg font-medium text-xs border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
              <CheckCircle2 size={16} /> Enviado
            </div>
          ) : status === "error" ? (
            <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-4 py-2 rounded-lg font-medium text-xs border border-red-500/20 max-w-[150px] truncate shadow-[0_0_10px_rgba(239,68,68,0.2)]" title={errorMessage}>
              <AlertCircle size={16} /> Erro
            </div>
          ) : (
            <button
              type="submit"
              disabled={!command.trim()}
              className="px-4 text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-blue-600 hover:bg-blue-500 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] shadow-blue-500/20 font-medium text-sm flex items-center gap-2 h-[42px]"
            >
              <Send size={16} /> <span className="hidden sm:inline">Despachar</span>
            </button>
          )}
        </div>
        
        {/* Glow effect for input */}
        <div className="absolute -inset-0.5 bg-blue-500/0 group-focus-within:bg-blue-500/5 rounded-xl blur-md -z-10 transition-colors pointer-events-none"></div>
      </form>
    </div>
  );
}
