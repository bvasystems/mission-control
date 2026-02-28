"use client";

import { signIn, signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export default function AuthButton() {
const { data: session } = useSession();

if (!session) {
return (
<button onClick={() => signIn("google")} className="text-sm border rounded px-3 py-1">
Entrar com Google
</button>
);
}

return (
<button onClick={() => signOut()} className="text-sm border rounded px-3 py-1">
Sair ({session.user?.email})
</button>
);
}
