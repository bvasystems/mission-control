"use client";

import { signIn, signOut, useSession } from "next-auth/react";

function getRole(email?: string | null) {
if (!email) return "L1";
// ajuste se quiser regra por domínio/usuário
if (email.includes("joao")) return "L4";
return "L1";
}

export default function AuthButton() {
const { data: session, status } = useSession();

if (status === "loading") {
return (
<button
disabled
className="w-full text-sm border border-zinc-700 rounded-xl px-3 py-2 opacity-60"
>
Carregando...
</button>
);
}

if (!session) {
return (
<button
onClick={() => signIn()}
className="w-full text-sm border border-zinc-700 rounded-xl px-3 py-2 hover:bg-zinc-900 bg-zinc-900/50"
>
Acessar Painel
</button>
);
}

const role = getRole(session.user?.email);

return (
<div className="space-y-3">
<div className="flex items-center gap-3">
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt="avatar"
            className="h-8 w-8 rounded-full border border-white/10"
          />
        ) : (
          <div className="h-8 w-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-medium text-zinc-300">
            {session.user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-zinc-200">{session.user?.name || "Operador"}</p>
          <p className="text-[10px] text-zinc-500 truncate">{session.user?.email}</p>
        </div>

        <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono tracking-wider">
          {role}
        </span>
</div>

<button
onClick={() => signOut()}
className="w-full text-sm border border-zinc-700 rounded-xl px-3 py-2 hover:bg-zinc-900"
>
Sair
</button>
</div>
);
}
