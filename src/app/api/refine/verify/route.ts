// 校验一个候选模型配置能不能用（对齐 hello-ai 的 /api/model-context 的职责：
// 添加模型前先打一发真实请求，省得加了才发现是坏的）。
//
// 入参：{ baseUrl, model, apiKey? }；apiKey 省略时用服务端环境变量里的密钥。
// 返回：{ ok: true } 或 { ok: false, error, detail }
// ⚠ 只回状态与上游错误摘要，绝不回显密钥。
export const runtime = "edge";

function pick(...vals: (string | undefined)[]): string {
  for (const v of vals ?? []) {
    const s = (v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export async function POST(req: Request) {
  let body: { baseUrl?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const rawBase = (body.baseUrl ?? "").trim() || pick(process.env.REFINE_BASE_URL, process.env.CUSTOM_BASE_URL) || "https://openrouter.ai/api/v1";
  const model = (body.model ?? "").trim() || pick(process.env.REFINE_MODEL, process.env.CUSTOM_MODEL);
  const apiKey = (body.apiKey ?? "").trim() || pick(process.env.REFINE_API_KEY, process.env.CUSTOM_API_KEY);

  const base = rawBase.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return Response.json({ ok: false, error: `API 地址不合法：${base}` }, { status: 400 });
  if (!model) return Response.json({ ok: false, error: "缺少模型 ID" }, { status: 400 });
  if (!apiKey) return Response.json({ ok: false, error: "缺少 API Key（可留空以使用服务端密钥）" }, { status: 400 });

  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 16,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return Response.json({ ok: false, error: `大模型返回 ${res.status}`, detail }, { status: 200 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: "调用失败", detail: msg.slice(0, 200) }, { status: 200 });
  }
}
