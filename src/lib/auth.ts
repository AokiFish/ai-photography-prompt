/**
 * 登录模块：GitHub / Google（移植自 D:\Mydata\hone\bun\hello-ai\src\auth.ts）。
 *
 * 适配点（相对原版）：
 * - 路由前缀统一为 /api/auth（Next.js 把认证挂在 /api 下，OAuth 回调也用 /api/auth/callback/:p）。
 * - 仅依赖 request/url + process.env（Cloudflare Pages 环境变量 / secrets），不依赖 Worker Env 对象。
 *
 * 设计要点：
 * - 会话用 HMAC-SHA256 签名的 HttpOnly Cookie（sid），不写 D1，避免登录热写。
 * - OAuth 走弹窗：/api/auth/login/:p 302 到服务商，用户授权后服务商把弹窗跳回
 *   /api/auth/callback/:p，回调写 Cookie 并返回一段关闭弹窗 + postMessage 的 HTML。
 * - 各服务商的 Client ID/Secret 必须配成 Pages 环境变量（secret）；缺哪个，/api/auth/config 就报哪个不可用，
 *   前端对应按钮置灰，代码本身始终就绪。
 * - D1 用户表可选：配了 DB 就 upsert 一份（为后续按用户存数据做准备），没配也能正常登录。
 */
import type { D1Database } from "@/lib/d1-types";

export interface AuthUser {
  /** 稳定主键，形如 github:12345 */
  id: string;
  provider: string;
  name: string;
  email?: string;
  /** 头像值：provider=原 URL；builtin=builtin:<key>；custom=图片 data URL（不进 Cookie）；generated/未设置=空 */
  avatar?: string;
  /** 头像来源：provider | builtin | custom | generated */
  avatarSource?: string;
}

/** 本模块只关心这些环境变量（来自 process.env / Cloudflare Pages）。 */
export interface AuthEnv {
  DB?: D1Database;
  SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

/** 本项目所有认证路由的统一前缀（挂在 /api 下）。 */
const AUTH_PREFIX = "/api/auth";

const PROVIDERS = ["github", "google"] as const;
type Provider = (typeof PROVIDERS)[number];

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 天

/* ── 基础工具 ───────────────────────────────────────────── */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(enc(JSON.stringify(obj)));
}

function decB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc(secret) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc(data) as BufferSource);
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  const ab = enc(a);
  const bb = enc(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function sessionCookie(value: string, secure: boolean, maxAge: number): string {
  const parts = ["sid=" + value, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  parts.push(maxAge <= 0 ? "Max-Age=0" : "Max-Age=" + maxAge);
  return parts.join("; ");
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

/* ── 签名会话 ───────────────────────────────────────────── */

async function signSession(user: AuthUser, secret: string): Promise<string> {
  const payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
  const p = b64urlJson(payload);
  const sig = await hmac(secret, p);
  return `${p}.${sig}`;
}

/** 校验 sid Cookie 值（原始值，不含 sid= 前缀），失败返回 null。供服务端组件复用。 */
export async function verifySessionCookie(value: string | undefined, secret: string): Promise<AuthUser | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const p = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expect = await hmac(secret, p);
  if (!safeEqual(sig, expect)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decB64url(p)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.id,
      provider: payload.provider,
      name: payload.name,
      email: payload.email,
      avatar: payload.avatar,
      avatarSource: payload.avatarSource,
    };
  } catch {
    return null;
  }
}

/* ── 服务商可用性与授权地址 ─────────────────────────────── */

function providerEnabled(env: AuthEnv, p: Provider): boolean {
  switch (p) {
    case "github":
      return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
    case "google":
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }
  return false;
}

function authorizeUrl(p: Provider, env: AuthEnv, redirectUri: string, state: string): string {
  if (p === "github") {
    const u = new URL("https://github.com/login/oauth/authorize");
    u.searchParams.set("client_id", env.GITHUB_CLIENT_ID || "");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", "read:user user:email");
    u.searchParams.set("state", state);
    u.searchParams.set("allow_signup", "true");
    return u.toString();
  }
  if (p === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", env.GOOGLE_CLIENT_ID || "");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "openid email profile");
    u.searchParams.set("state", state);
    return u.toString();
  }
  return "";
}

/* ── 各服务商换票 + 取用户信息 ─────────────────────────── */

async function exchangeGithub(env: AuthEnv, code: string, redirectUri: string): Promise<{ user: AuthUser; providerId: string }> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  const access = token.access_token;
  if (!access) throw new Error("GitHub 授权失败");

  const profile = (await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${access}`, accept: "application/json", "user-agent": "ai-photography-prompt" },
  }).then((r) => r.json())) as { id?: number; login?: string; name?: string; email?: string; avatar_url?: string };

  let email = profile.email;
  if (!email) {
    try {
      const emails = (await fetch("https://api.github.com/user/emails", {
        headers: { authorization: `Bearer ${access}`, accept: "application/json", "user-agent": "ai-photography-prompt" },
      }).then((r) => r.json())) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails[0];
      email = primary?.email;
    } catch {
      /* 拿不到邮箱就忽略，GitHub 邮箱可设为私密 */
    }
  }

  const providerId = String(profile.id);
  return {
    providerId,
    user: {
      id: `github:${providerId}`,
      provider: "github",
      name: profile.name || profile.login || "GitHub 用户",
      email: email || undefined,
      avatar: profile.avatar_url || undefined,
    },
  };
}

async function exchangeGoogle(env: AuthEnv, code: string, redirectUri: string): Promise<{ user: AuthUser; providerId: string }> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  const access = token.access_token;
  if (!access) throw new Error("Google 授权失败");

  const info = (await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${access}` },
  }).then((r) => r.json())) as { id?: string; name?: string; email?: string; picture?: string };

  const providerId = String(info.id);
  return {
    providerId,
    user: {
      id: `google:${providerId}`,
      provider: "google",
      name: info.name || info.email || "Google 用户",
      email: info.email || undefined,
      avatar: info.picture || undefined,
    },
  };
}

/* ── D1 持久化（可选） ─────────────────────────────────── */

async function upsertUser(db: D1Database, user: AuthUser, providerId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, provider, provider_id, name, email, avatar, avatar_source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, email=excluded.email, avatar=excluded.avatar,
         avatar_source=excluded.avatar_source, updated_at=excluded.updated_at`,
    )
    .bind(
      user.id,
      user.provider,
      providerId,
      user.name,
      user.email ?? "",
      user.avatar ?? "",
      user.avatarSource ?? "provider",
      Date.now(),
    )
    .run();
}

/** 更新头像来源與值（落 D1，供跨设备读取；custom 的 data URL 存这里，不进 Cookie） */
async function updateAvatar(db: D1Database, id: string, avatar: string, source: string): Promise<void> {
  await db
    .prepare(`UPDATE users SET avatar=?, avatar_source=?, updated_at=? WHERE id=?`)
    .bind(avatar, source, Date.now(), id)
    .run();
}

/* ── 关闭弹窗的 HTML ──────────────────────────────────── */

function closePopupHtml(ok: boolean, msg?: string): string {
  const evt = ok ? "aipp:auth" : "aipp:auth:error";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${ok ? "登录成功" : "登录失败"}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0e0f13;color:#e6e7ea}</style></head>
<body><div>${ok ? "✅ 登录成功，正在关闭…" : "⚠️ " + (msg || "登录失败")}</div>
<script>
(function(){
  try{ window.opener && window.opener.postMessage({type:${JSON.stringify(evt)},message:${JSON.stringify(msg || "")}}, location.origin); }catch(e){}
  setTimeout(function(){ try{ window.close(); }catch(e){} }, 400);
})();
</script></body></html>`;
}

/* ── 回调处理 ──────────────────────────────────────────── */

async function handleCallback(p: Provider, env: AuthEnv, request: Request, url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const secret = env.SESSION_SECRET || "";
  const secure = url.protocol === "https:";

  if (!code) return new Response(closePopupHtml(false, "缺少授权码"), { headers: { "content-type": "text/html; charset=utf-8" } });
  if (!secret) return new Response(closePopupHtml(false, "服务端未配置 SESSION_SECRET"), { headers: { "content-type": "text/html; charset=utf-8" } });

  const cookie = request.headers.get("cookie") || "";
  const savedState = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("oauth_state="))
    ?.slice("oauth_state=".length);
  if (!state || !savedState || state !== savedState) {
    return new Response(closePopupHtml(false, "state 校验失败，请重试"), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  let user: AuthUser;
  let providerId: string;
  try {
    if (p === "github") ({ user, providerId } = await exchangeGithub(env, code, `${url.origin}${AUTH_PREFIX}/callback/github`));
    else ({ user, providerId } = await exchangeGoogle(env, code, `${url.origin}${AUTH_PREFIX}/callback/google`));
  } catch (e) {
    const m = e instanceof Error ? e.message : "授权失败";
    return new Response(closePopupHtml(false, m), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // 登录默认采用服务商头像；用户之后可在「更换头像」里改成内置/自定义/随机
  user.avatarSource = "provider";

  if (env.DB) {
    try {
      await upsertUser(env.DB, user, providerId);
    } catch {
      /* 落库失败不影响登录，Cookie 已含用户信息 */
    }
  }

  const token = await signSession(user, secret);
  return new Response(closePopupHtml(true), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "set-cookie": sessionCookie(token, secure, SESSION_TTL),
    },
  });
}

/* ── 更新头像 ──────────────────────────────────────────── */

async function handleAvatar(env: AuthEnv, request: Request, url: URL): Promise<Response> {
  const secret = env.SESSION_SECRET || "";
  if (!secret) return json({ error: "服务端未配置 SESSION_SECRET" }, 500);
  const user = await verifySessionCookie(getSid(request), secret);
  if (!user) return json({ error: "未登录" }, 401);

  let body: { source?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }
  const source = body.source;
  const raw = typeof body.value === "string" ? body.value : "";
  const ALLOWED = ["provider", "builtin", "custom", "generated"];
  if (typeof source !== "string" || !ALLOWED.includes(source)) return json({ error: "非法的头像来源" }, 400);

  let storeAvatar = raw;
  if (source === "builtin") {
    if (!/^(fox|cat|panda|robot|alien|ghost)$/.test(raw)) return json({ error: "未知的内置头像" }, 400);
    storeAvatar = `builtin:${raw}`;
  } else if (source === "custom") {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(raw)) return json({ error: "仅支持图片 data URL" }, 400);
    if (raw.length > 60000) return json({ error: "头像过大（请压缩到约 45KB 以内）" }, 400);
  } else if (source === "provider") {
    if (!/^https?:\/\//.test(raw)) return json({ error: "非法的服务商头像地址" }, 400);
  } else {
    storeAvatar = ""; // generated
  }

  if (env.DB) {
    try {
      await updateAvatar(env.DB, user.id, storeAvatar, source);
    } catch {
      /* 落库失败不阻断，至少本次会话与本地生效 */
    }
  }

  const cookieUser: AuthUser = {
    ...user,
    avatar: source === "custom" ? "" : storeAvatar,
    avatarSource: source,
  };
  const token = await signSession(cookieUser, secret);
  const secure = url.protocol === "https:";
  const cookie = sessionCookie(token, secure, SESSION_TTL);
  return new Response(JSON.stringify({ ok: true, user: cookieUser }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": cookie,
    },
  });
}

function getSid(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") || "";
  return cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sid="))
    ?.slice("sid=".length);
}

/* ── 路由入口 ──────────────────────────────────────────── */

/**
 * 处理所有 /api/auth/* 请求；返回 null 表示不是认证路由，交由主 fetch 继续。
 */
export async function handleAuth(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;

  if (path === `${AUTH_PREFIX}/me`) {
    const secret = env.SESSION_SECRET || "";
    const user = secret ? await verifySessionCookie(getSid(request), secret) : null;
    // custom 头像不在 Cookie 里，从 D1 取 data URL 返回
    if (user && env.DB && user.avatarSource === "custom") {
      try {
        const row = (await env.DB.prepare(`SELECT avatar FROM users WHERE id=?`).bind(user.id).first()) as
          | { avatar?: string }
          | null;
        if (row?.avatar) user.avatar = row.avatar;
      } catch {
        /* 取不到就回退到本地/生成头像 */
      }
    }
    return json({ user });
  }

  if (path === `${AUTH_PREFIX}/config`) {
    return json({
      providers: {
        github: providerEnabled(env, "github"),
        google: providerEnabled(env, "google"),
      },
    });
  }

  if (path === `${AUTH_PREFIX}/logout`) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": sessionCookie("", url.protocol === "https:", 0),
      },
    });
  }

  if (path === `${AUTH_PREFIX}/avatar` && request.method === "POST") {
    return handleAvatar(env, request, url);
  }

  const login = path.match(/^\/api\/auth\/login\/(\w+)$/);
  if (login) {
    const p = login[1] as Provider;
    if (!PROVIDERS.includes(p) || !providerEnabled(env, p)) {
      return new Response("该登录方式未配置（请在 Cloudflare 配置对应的 Client ID / Secret）", { status: 400 });
    }
    const redirectUri = `${url.origin}${AUTH_PREFIX}/callback/${p}`;
    const state = randomState();
    const cookie = `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${url.protocol === "https:" ? "; Secure" : ""}`;
    return new Response(null, {
      status: 302,
      headers: { location: authorizeUrl(p, env, redirectUri, state), "set-cookie": cookie },
    });
  }

  const cb = path.match(/^\/api\/auth\/callback\/(\w+)$/);
  if (cb) {
    const p = cb[1] as Provider;
    if (!PROVIDERS.includes(p)) return json({ error: "未知登录方式" }, 400);
    return handleCallback(p, env, request, url);
  }

  return null;
}
