import type { HomePlate } from "@/lib/types";

// 首页六帧图鉴 — 移植自 demo HTML，数据驱动渲染
export const HOME_PLATES: HomePlate[] = [
  {
    num: "01",
    title: "电影感",
    en: "Cinematic",
    style: "cinematic",
    tag: "叙事 · 氛围 · 影调",
    desc: "像电影剧照般的画面，靠光线、影调与纵深讲故事。适合需要情绪与氛围的叙事性内容——雨夜、黄昏、孤独剪影。关键词落在「电影感」与「影调」上，让 AI 往银幕而非快照的方向走。",
    core: "cinematic film still, shallow depth of field, teal-orange grade, anamorphic, moody atmosphere",
    full: "Cinematic film still: a lone figure crossing a rain-soaked city street at dusk, warm amber streetlights reflecting on wet asphalt, deep shadows, volumetric haze, subtle anamorphic lens flare, shallow depth of field, moody teal-orange color grade, fine 35mm film grain, high-end cinematography, award-winning composition",
    exif: ["35mm", "f/1.8", "teal-orange", "mood"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/NHMLbPdhSoSUbnxJ3C9cS65gncn",
  },
  {
    num: "02",
    title: "极简",
    en: "Minimalist",
    style: "minimalist",
    tag: "克制 · 留白 · 秩序",
    desc: "单一主体置于大面留白，构图精准，色彩收敛——追求「少即是多」。适合产品、静物与需要高级秩序感的画面。重点给出「留白」「单一主体」「柔和光」这三个锚点，画面自然安静下来。",
    core: "minimalist, single subject, negative space, soft diffused light, muted palette, precise composition",
    full: "Minimalist fine art photography: a single white ceramic sphere on a warm beige seamless background, soft diffused studio lighting, one gentle long shadow, generous negative space, precise geometric composition, muted earthy palette, editorial, ultra clean",
    exif: ["studio", "softbox", "beige", "negative space"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/Zh9AbuEzAogq5cxMLYkcXsQYnNN",
  },
  {
    num: "03",
    title: "胶片感",
    en: "Film",
    style: "film",
    tag: "颗粒 · 怀旧 · 纪实",
    desc: "复古胶片的色彩与颗粒，带着温度的「不完美」。适合纪实、街拍、怀旧叙事。直接点名胶片型号（如 kodak gold）与「颗粒」「漏光」这类胶片特有瑕疵，是让画面脱离数码感的捷径。",
    core: "35mm film, kodak tones, film grain, light leak, nostalgic, documentary",
    full: "Vintage 35mm film photograph: candid street scene in a quiet old town alley, faded kodak gold tones, pronounced film grain, slight warm light leak on the edge, nostalgic color, natural soft light, documentary style, imperfect and authentic",
    exif: ["kodak gold", "35mm", "grain", "candid"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/SwUbbT9v6o0bPcxDoJZc8pkpnAq",
  },
  {
    num: "04",
    title: "黑白艺术",
    en: "Monochrome",
    style: "monochrome",
    tag: "光影 · 对比 · 经典",
    desc: "剥离色彩，只剩光影的骨骼。高对比的明暗分层让情绪有了重量。适合人像、肖像与追求「经典感」的画面。关键词「明暗对照 chiaroscuro」与「高对比」是黑白出彩的灵魂。",
    core: "black and white, chiaroscuro, high contrast, dramatic lighting, fine art portrait",
    full: "High-contrast black and white fine art portrait: dramatic chiaroscuro lighting on a woman's face half in shadow, textured skin and fabric detail, deep blacks and bright highlights, timeless classical composition, large format film look, expressive, gallery quality",
    exif: ["B&W", "large format", "chiaroscuro", "gallery"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/JmcbbPascoFOK8x7uLecgRIQnee",
  },
  {
    num: "05",
    title: "自然微距",
    en: "Macro",
    style: "macro",
    tag: "细节 · 虚化 · 生机",
    desc: "把毫厘放大成世界。极致的清晰与柔和的背景虚化，让寻常之物焕发神采。适合自然、植物、产品细节。关键词「极近微距」「超高清晰」配「柔焦背景」，一前一后立刻拉开层次。",
    core: "extreme macro, dew drop, ultra sharp, soft bokeh, vivid natural colors, botanical",
    full: "Extreme macro photography: a single large dew drop resting on a green leaf edge refracting soft morning light, ultra sharp detail, soft bokeh background, vivid natural greens, shallow depth of field, botanical fine art, crisp and luminous",
    exif: ["macro 1:1", "f/2.8", "bokeh", "botanical"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/OcE0bIxcdoRO2KxDiUCctaI0nJc",
  },
  {
    num: "06",
    title: "都市夜影",
    en: "City Noir",
    style: "noir",
    tag: "霓虹 · 冷调 · 氛围",
    desc: "城市入夜后的另一副面孔——霓虹、湿漉的路面与光雾。适合赛博朋克、都市情绪、夜晚叙事。关键词「霓虹」「潮湿路面的倒影」「光雾」三件套，立刻把人拉进雨夜的都市深处。",
    core: "cyberpunk noir, neon, wet street reflection, cinematic haze, high contrast",
    full: "Cyberpunk noir city night: neon signs glowing cyan and magenta reflecting on wet narrow alley pavement, cinematic atmosphere with light haze and rain droplets, high contrast, futuristic yet gritty, atmospheric depth, striking color palette",
    exif: ["neon", "cyan/magenta", "noir", "night"],
    imageUrl:
      "https://media.doubao.com/space/api/box/stream/download/all_by_mount_point/CFUAbqcuaooT3VxQfw6cLhzKnpc",
  },
];

// 配方拆解（首页底部）
export const RECIPE_STEPS = [
  {
    n: "01",
    title: "主体与场景",
    en: "Subject & Scene",
    ex: "a lone figure crossing a rain-soaked city street",
    note: "先把「谁、在哪里、做什么」交代清楚，这是画面的地基，其余都围着它转。",
  },
  {
    n: "02",
    title: "光线与氛围",
    en: "Light & Mood",
    ex: "warm amber streetlights, deep shadows, volumetric haze",
    note: "光的来向、色温与软硬，决定情绪。黄昏、霓虹、柔光箱——说具体点。",
  },
  {
    n: "03",
    title: "镜头与画幅",
    en: "Lens & Format",
    ex: "shallow depth of field, anamorphic, 35mm",
    note: "景深、焦段、画幅与镜头特征，控制取景与纵深的语言。",
  },
  {
    n: "04",
    title: "色彩与影调",
    en: "Color & Tone",
    ex: "moody teal-orange color grade",
    note: "明确色板与影调（冷暖、高低调），画面风格在此定型。",
  },
  {
    n: "05",
    title: "质感与媒介",
    en: "Texture & Medium",
    ex: "35mm film grain, award-winning composition",
    note: "颗粒、胶片、印刷质感等「媒介指纹」，让成品更像真实摄影。",
  },
  {
    n: "·",
    title: "一句话心法",
    en: "One Rule",
    ex: "",
    note: "先想画面，再写句子；给 AI 具体的名词与动词，而非抽象的形容词堆叠。",
  },
];
