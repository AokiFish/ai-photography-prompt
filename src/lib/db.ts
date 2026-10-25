import type { D1Database } from "@/lib/d1-types";
import { getOptionalRequestContext } from "@cloudflare/next-on-pages";

// 在 Cloudflare Pages (next-on-pages) 运行时取 D1 绑定；
// 本地 `next dev` 或构建期取不到时返回 null，调用方回退到种子数据。
// 注意：此模块含 `server-only`，仅可在服务端（RSC / Route Handler）导入。
let cached: D1Database | null | undefined;

export function getDB(): D1Database | null {
  if (cached !== undefined) return cached;
  const ctx = getOptionalRequestContext();
  cached = ((ctx?.env as Record<string, unknown> | undefined)?.DB as D1Database) ?? null;
  return cached;
}
