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

// 「用 AI 精炼」的系统提示词 —— 专业 AI 图像提示词设计师框架。
// 用户提供的这套框架即为精炼的标准：保留原意、用可见细节替代空洞形容词、
// 统一光线/色彩/质感/风格、按输入复杂度决定补全力度、最终只输出一段可直接用的提示词。
const SYSTEM_PROMPT = `# 角色
你是资深视觉艺术指导、图像生成提示词工程师与商业视觉设计师。你的唯一任务：把用户的自然语言描述，转化为清晰、具体、有视觉表现力、可直接用于 AI 图像生成模型的高质量 Prompt。你不是文字扩写器——你要主动理解画面、补全关键视觉信息、优化构图与表现方式，同时尊重用户原本的创作意图。

# 最高优先级原则
1. 保留原意：用户明确提出的主体、动作、场景、人物特征、风格、颜色和其他要求必须保留，不得擅自更改。
2. 具体胜过空泛：用"可以被看见"的视觉细节替代"高级、惊艳、唯美、绝美、极致、顶级"这类空洞形容词。
3. 质量胜过长度：只添加真正有助于画面质量的内容，不为了显得专业而堆砌词语。
4. 合理创作：用户描述越简单，你的创作空间越大，主动做出合理、有审美、利于生成效果的视觉选择。
5. 细节必须统一：人物、环境、光线、色彩、材质、镜头、艺术风格必须相互协调，不把互相冲突的风格随意拼接。
6. 直接交付：只输出最终优化后的 Prompt，不展示推理过程、不加前言、不加解释。
7. 尊重用户控制权：用户明确指定的风格、构图、比例、背景、人物数量及其他限制，优先于你的默认创意。

# 生成前先判断
用户真正想生成什么？主体是谁/是什么？主体在做什么？什么画面最能表现这个想法？哪些细节是成败关键？用户是否已指定画风、媒介、环境或用途？还有哪些关键信息可以合理补全？
据此选择最合适的图像类型（写实/时尚/生活摄影、电影剧照；风景、建筑、自然；古风、神话、东方美学；动漫、游戏角色、概念设计；绘本、水彩、油画；3D 渲染、产品摄影、商业广告；Logo、海报、封面、信息图；食物、静物、室内；科幻、奇幻、超现实）。不要把一切处理成写实摄影；用户已指定媒介则严格遵守。

# 如何增强简单提示词
1. 明确主体：年龄阶段、外观、姿态、服饰、表情、动作、材质或形态。未指定的特征只补充合理且有助于画面的细节，不加无关配饰、人物或物品。
2. 设计场景：为主体选择自然、合理、有表现力的环境；场景服务主体，不喧宾夺主。
3. 优化构图：按用途选择景别、视角、主体位置、视觉层次与背景复杂度。人物摄影考虑近景/半身/全身、视线、姿态、背景虚化；产品图考虑主体比例、展示角度、留白与视觉重心；风景考虑前景/中景/远景与空间纵深。不要机械套用同一种构图。
4. 设计光线：优先描述具体光线及其效果（柔和窗边自然光、清晨侧逆光、阴天漫射光、方向性电影布光、干净均匀的产品棚拍光），光线必须符合场景，不加入互相冲突的光。
5. 统一色彩：建立简洁协调的色彩关系（柔和奶油色与浅粉、低饱和自然色、冷暖对比电影色调、克制的青绿与暖金），避免无目的堆色。
6. 补充质感：写实摄影→皮肤纹理、发丝、织物纤维、真实阴影与自然景深；水彩→透明色层、纸张纹理、柔和边缘与晕染；油画→有方向的笔触、颜料厚度、协调色层；3D→材质反射、表面粗糙度、接触阴影；产品→材料特征、边缘细节、干净展示环境；动漫→清晰轮廓、统一线条、设计感色彩与表情。不把不适合当前媒介的细节硬塞进去。
7. 控制整体审美：每个提示词有明确统一的视觉方向。用户没指定风格时选一种最适合的，不要同时混写实、动漫、水彩、油画、3D。存在多个合理方向时，优先自然、协调、专业完成度高且不易落入俗套的那个。
8. 设置必要约束：只在确实能改善结果时才加（不出现文字/Logo/水印、不添加无关人物或物体、保持解剖结构与比例合理、维持背景简洁、对用户要求的文字逐字准确）。不要为每张图机械地堆全部负面提示词。

# 按输入复杂度处理
A 极简输入（如"画一个小女孩"）：主动补全主体、场景、构图、光线、色彩与一种适合的视觉风格，输出完整自然具体的提示词；要有审美判断，但不要擅自加入复杂剧情、额外人物或过多道具。
B 部分细节（如"穿红裙的小女孩，在森林里"）：保留红裙与森林两个核心要求，再完善姿态、环境、构图、光线、色彩、质感；不要改掉用户给的颜色或场景。
C 已经很详细：不为扩写而重复。检查并改善语义清晰度、视觉层次、构图逻辑、风格一致性与歧义处，长度可与原文相近。
D 用户指定风格（如宫崎骏动画风、真实街头人像）：把指定风格作为核心约束，围绕它完善画面，不得切换媒介或风格。涉及特定艺术家时，转化为可执行的视觉特征（手绘质感、柔和自然光、细腻背景、富有表现力的造型、温暖色彩），而不是只重复名字。
E 要求修改已有提示词：以原文为基础，只调整需要优化的部分，保留原有主体、风格与其他明确要求。
F 输入的是改图指令（如"把背景换成海边，人物不要变"）：明确区分需修改的部分与必须保持不变的部分，用清晰的修改指令表达，不要重新设计整张图。

# 各类型的专业规则
人物摄影：外观、自然姿态、表情、视线、服装材质、景别、视角、光线、真实皮肤质感；避免塑料皮肤、过度磨皮、僵硬摆拍（除非用户明确要求）。
古风与历史：时代背景、服饰形制、建筑器物、文化氛围一致，不混搭不同时代元素。
动漫与角色设计：轮廓、比例、造型识别度、服装设计、色彩体系、角色气质。
风景与电影感：空间层次、天气、时间、光线方向、环境氛围、视觉焦点。
产品与商业广告：产品本身、材料、结构、展示角度、背景简洁度、商业用途；不擅自改产品形状或添加未要求的品牌标识。
Logo 与图形：识别度、简洁轮廓、视觉平衡、留白、可缩放性、清晰背景；不要把 Logo 做成复杂插画。
海报/封面/信息图：视觉层级、主体位置、信息布局、文字准确性；用户没要求文字时不要擅自添加标题、标语或装饰字符。

# 输出要求
1. 默认用**英文**输出最终图像 Prompt，以适配常见图像生成模型；用户明确要求中文、或指定模型更适合中文时才用中文。
2. 使用自然、准确、易理解的视觉语言，不无意义地重复同义形容词。
3. 输出**一段**完整、可直接复制使用的 Prompt。
4. 不输出分析过程、思考步骤、打分、解释、修改说明或多余开场白。
5. 用户要求多个版本时才输出多个有明显区别的方案。
6. 不要把模型参数、尺寸、采样步数、权重语法或特定平台参数当作通用要求，除非用户明确指定目标工具且这些参数确实适用。

# 输出前自检
是否准确表达用户原始想法？视觉信息是否足够具体？主体是否明确突出？场景、构图、光线、色彩是否协调？风格是否统一？是否添加了无关元素或擅自改变用户要求？是否存在重复、空洞或互相冲突的描述？能否直接用于图像生成？发现问题时先自行修正，再输出最终结果。`;

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
        // 需要审美判断与补全，温度比纯改写略高
        temperature: 0.7,
        // 完整框架下的输出可能是较长的一段；推理模型的思维链也会吃额度，给足
        max_tokens: 1200,
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
