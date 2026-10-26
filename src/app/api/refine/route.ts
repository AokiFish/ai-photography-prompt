// 「用 AI 精炼」：把用户写的场景描述（或整条提示词）交给大模型润色成更适合图像模型的英文。
//
// 走 **OpenAI 兼容的 chat/completions** 协议。实现要点参照已跑通的
// D:\Mydata\hone\bun\hello-ai（它的 src/index.ts 与 src/Components/modelCatalog.ts）：
//   1. 地址容错：base 已以 /chat/completions 结尾就不再拼接（用户常直接粘完整 endpoint）
//   2. 模型**必须显式指定**（除 OpenRouter 有默认兜底）——否则会拿 openai/gpt-4o-mini
//      去打 Agnes 这类第三方网关，模型不存在必然报错
//   3. 变量两套命名都认：REFINE_*（本项目）与 CUSTOM_*（沿用 hello-ai 的习惯）
//   4. 输出额度给足，避免推理类模型的思维链吃光预算导致空回复
//
// 环境变量（Cloudflare Pages → Settings → Environment variables；本地写 .dev.vars / .env.local）：
//   REFINE_API_KEY / CUSTOM_API_KEY   必填
//   REFINE_BASE_URL / CUSTOM_BASE_URL 选填，默认 https://openrouter.ai/api/v1
//   REFINE_MODEL / CUSTOM_MODEL       第三方服务**必填**（如 agnes-3.0-flash）
//
// ⚠ 密钥只在服务端读取，绝不返回给前端、绝不写日志。
export const runtime = "edge";

const SYSTEM_PROMPT =
  "You are a photography prompt editor. Rewrite the user's description into ONE concise, vivid English image prompt. " +
  "Rules: keep every concrete fact (who, what, where, when, mood); add concrete photography detail only when it follows from the text; " +
  "no model parameters, no bullet lists, no explanations, no quotes around the result. " +
  "If the text is already good English, just tighten it. If it is in another language, translate faithfully. " +
  "Output the prompt text and nothing else.";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** 依次取第一个非空值（两套变量命名都支持） */
function pick(...vals: (string | undefined)[]): string {
  for (const v of vals ?? []) {
    const s = (v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export async function POST(req: Request) {
  // 先解析请求体：客户端可以临时指定模型覆盖（对齐 hello-ai 的 chat 端点：
  // 「有服务端配置就用服务端，否则用请求体里带的」）。
  let reqBody: { text?: string; baseUrl?: string; apiKey?: string; model?: string } = {};
  try {
    reqBody = (await req.json()) as typeof reqBody;
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const apiKey = pick(reqBody.apiKey, process.env.REFINE_API_KEY, process.env.CUSTOM_API_KEY);
  const rawBase = pick(reqBody.baseUrl, process.env.REFINE_BASE_URL, process.env.CUSTOM_BASE_URL) || DEFAULT_BASE_URL;
  const model = pick(reqBody.model, process.env.REFINE_MODEL, process.env.CUSTOM_MODEL);

  if (!apiKey) {
    // 只回「变量是否存在」与解析后的地址，**绝不回显密钥本身**
    return Response.json(
      {
        error: "未配置 API Key",
        hint: "Pages 环境变量加 REFINE_API_KEY（或 CUSTOM_API_KEY）后必须重新部署才生效",
        seen: {
          apiKey: false,
          baseUrl: rawBase,
          model: model || "(未设置)",
        },
      },
      { status: 503 }
    );
  }

  const base = rawBase.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return Response.json({ error: `API 地址不合法：${base}`, hint: "需要 http/https 开头" }, { status: 500 });
  }

  const isOpenRouter = /openrouter\.ai/i.test(base);
  // 第三方网关（Agnes 等）没有通用默认模型，必须显式指定，否则必然「模型不存在」
  if (!model && !isOpenRouter) {
    return Response.json(
      {
        error: "未配置模型",
        hint: "请在 Pages 环境变量加 REFINE_MODEL（或 CUSTOM_MODEL），例如 agnes-3.0-flash",
        seen: { apiKey: true, baseUrl: base, model: "(未设置)" },
      },
      { status: 503 }
    );
  }
  const finalModel = model || DEFAULT_MODEL;

  const text = (reqBody.text ?? "").trim().slice(0, 4000);
  if (!text) return Response.json({ error: "没有可精炼的内容" }, { status: 400 });

  // 地址容错：用户可能直接粘了完整 endpoint
  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.6,
        // 推理类模型的思维链会吃额度，给足一点，避免正文被挤没
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return Response.json(
        { error: `大模型返回 ${res.status}`, detail, hint: `model=${finalModel} base=${base}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; text?: string }[];
    };
    const out = ((data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text) ?? "").trim();
    if (!out) return Response.json({ error: "大模型返回为空", hint: `model=${finalModel}` }, { status: 502 });
    return Response.json({ text: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "调用大模型失败", detail: msg.slice(0, 200) }, { status: 502 });
  }
}
