// 「用 AI 精炼」：把用户写的场景描述（或整条提示词）交给大模型润色成更适合图像模型的英文。
//
// 走 **OpenAI 兼容的 chat/completions** 协议，凭据与模型全部走环境变量，
// 因此 OpenRouter、Agnes、自建网关等只要兼容 OpenAI 接口都能接：
//   REFINE_API_KEY   必填；不配置时接口返回 503，前端会提示「未配置大模型凭据」
//   REFINE_BASE_URL  选填，默认 https://openrouter.ai/api/v1（填到 base URL，不要带 /chat/completions）
//   REFINE_MODEL     选填，默认 openai/gpt-4o-mini
//
// ⚠ 密钥只在服务端读取，绝不返回给前端、绝不写日志。
export const runtime = "edge";

const SYSTEM_PROMPT =
  "You are a photography prompt editor. Rewrite the user's description into ONE concise, vivid English image prompt. " +
  "Rules: keep every concrete fact (who, what, where, when, mood); add concrete photography detail only when it follows from the text; " +
  "no model parameters, no bullet lists, no explanations, no quotes around the result. " +
  "If the text is already good English, just tighten it. If it is in another language, translate faithfully. " +
  "Output the prompt text and nothing else.";

export async function POST(req: Request) {
  const apiKey = (process.env.REFINE_API_KEY ?? "").trim();
  if (!apiKey) {
    return Response.json(
      { error: "未配置 REFINE_API_KEY（Pages 环境变量里加上大模型凭据即可启用）" },
      { status: 503 }
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 4000);
  if (!text) return Response.json({ error: "没有可精炼的内容" }, { status: 400 });

  const base = (process.env.REFINE_BASE_URL ?? "https://openrouter.ai/api/v1").trim().replace(/\/+$/, "");
  const model = (process.env.REFINE_MODEL ?? "openai/gpt-4o-mini").trim();

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      // 只回状态与上游返回体的前 300 字符，便于排查又不至于泄漏多余内容
      const detail = (await res.text()).slice(0, 300);
      return Response.json({ error: `大模型返回 ${res.status}`, detail }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const out = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!out) return Response.json({ error: "大模型返回为空" }, { status: 502 });
    return Response.json({ text: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "调用大模型失败", detail: msg.slice(0, 200) }, { status: 502 });
  }
}
