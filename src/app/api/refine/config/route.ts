// 返回服务端已配置的「默认模型」信息供前端展示与选择。
// 对齐 D:\Mydata\hone\bun\hello-ai 的 /api/config：**只回非密钥信息，密钥永不外泄**。
export const runtime = "edge";

function pick(...vals: (string | undefined)[]): string {
  for (const v of vals ?? []) {
    const s = (v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export async function GET() {
  const apiKey = pick(process.env.REFINE_API_KEY, process.env.CUSTOM_API_KEY);
  const baseUrl = pick(process.env.REFINE_BASE_URL, process.env.CUSTOM_BASE_URL) || "https://openrouter.ai/api/v1";
  const model = pick(process.env.REFINE_MODEL, process.env.CUSTOM_MODEL);

  return Response.json({
    hasKey: !!apiKey,
    default: apiKey
      ? {
          id: "server",
          label: model ? `服务端配置 · ${model}` : "服务端配置（未指定模型）",
          baseUrl: baseUrl.replace(/\/+$/, ""),
          model,
          // 明确告诉前端：这一项不需要填密钥，用服务端的
          useServerKey: true,
        }
      : null,
  });
}
