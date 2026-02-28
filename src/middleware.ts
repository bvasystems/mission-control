export { auth as middleware } from "@/auth";

export const config = {
matcher: [
"/",
"/kanban",
"/crons",
"/agents",
"/incidents",
"/api/dashboard/:path*",
"/api/kanban/:path*",
],
};
