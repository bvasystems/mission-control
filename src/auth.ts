import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Acesso Restrito",
      credentials: {
        email: { label: "E-mail", type: "email", placeholder: "admin@bvasystems.com.br" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        // Você pode configurar estas variáveis no seu .env.local e lá na Vercel
        const adminEmail = process.env.ADMIN_EMAIL || "admin@bvasystems.com.br";
        const adminPass = process.env.ADMIN_PASSWORD || "admin123";

        if (credentials?.email === adminEmail && credentials?.password === adminPass) {
          return {
            id: "1",
            name: "Administrador BVA",
            email: adminEmail,
          };
        }

        // Se retornar nulo, o login é negado
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
});
