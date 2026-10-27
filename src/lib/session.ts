// 服务端组件读取当前登录用户（基于 HMAC 签名的 sid Cookie）。
// 仅在 edge runtime 的服务端代码里调用（layout / page）。密钥缺失或 Cookie 无效 → null。
import { cookies } from "next/headers";
import { verifySessionCookie, type AuthUser } from "@/lib/auth";

export async function getServerUser(): Promise<AuthUser | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) return null;
  return verifySessionCookie(sid, secret);
}
