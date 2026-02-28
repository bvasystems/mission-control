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
onClick={() => signIn("google")}
className="w-full text-sm border border-zinc-700 rounded-xl px-3 py-2 hover:bg-zinc-900"
>
Entrar com Google
</button>
);
}

const role = getRole(session.user?.email);

return (
<div className="space-y-3">
<div className="flex items-center gap-3">
{session.user?.image ? (
<img
src={session.user.image}
alt="avatar"
className="h-9 w-9 rounded-full border border-zinc-700"
/>
) : (
<div className="h-9 w-9 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-xs">
{session.user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
</div>
)}

<div className="min-w-0">
<p className="text-sm font-medium truncate">{session.user?.name || "Usuário"}</p>
<p className="text-xs text-zinc-400 truncate">{session.user?.email}</p>
</div>

<span className="text-[10px] px-2 py-1 rounded-full border border-blue-500/30 bg-blue-500/20 text-blue-300">
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
