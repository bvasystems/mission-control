import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
providers: [
Google({
clientId: process.env.GOOGLE_CLIENT_ID!,
clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
}),
],
session: { strategy: "jwt" },
callbacks: {
async signIn({ profile }) {
// opcional: restringir domínio
// return profile?.email?.endsWith("@bvasystems.com") ?? false;
return true;
},
},
});
