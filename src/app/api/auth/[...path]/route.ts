// 认证路由：把 /api/auth/* 全部转发给移植自 hello-ai 的 handleAuth。
// 仅在 edge runtime 内运行（依赖 Web Crypto / btoa / atob / fetch 到外部 OAuth）。
import { handleAuth, type AuthEnv } from "@/lib/auth";
import { getDB } from "@/lib/db";

export const runtime = "edge";

function env(): AuthEnv {
  return {
    DB: getDB() ?? undefined,
    SESSION_SECRET: process.env.SESSION_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  };
}

async function dispatch(req: Request, pathParts: string[]): Promise<Response> {
  const url = new URL(req.url);
  url.pathname = "/api/auth/" + pathParts.join("/");
  const res = await handleAuth(req, env(), url);
  if (res) return res;
  return new Response("Not Found", { status: 404 });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path ?? []);
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path ?? []);
}
