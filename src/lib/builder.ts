// 提示词构建器（/builder）的分类数据 + 拼装逻辑。
//
// 维度设计参考 kadar.studio 的 **视觉化图片提示词构建器**：不去让用户背参数，
// 而是把「照片是怎么拍出来的」拆成一串可选的下拉式视觉项。
// 每个选项带三份信息：
//   zh   — 中文名（界面显示）
//   desc — 中文一句话注解（告诉用户这会带来什么画面效果）
//   en   — 拼进最终提示词的英文短语（写给 Midjourney / SD / Nano Banana 等模型）
//
// 页面锚点与 hash 路由一一对应：#cat-style / #cat-expr / #cat-camera / #cat-shot /
// #cat-angle / #cat-lens / #cat-aperture / #cat-motion / #cat-light / #cat-texture /
// #cat-mood / #cat-comp / #cat-ratio。

export interface BuilderOption {
  id: string;
  zh: string;
  desc: string;
  en: string;
}

export interface BuilderCategory {
  id: string; // 与 hash 后缀一致：cat-<id>
  zh: string; // 中文类目名
  en: string; // 英文类目名（用于面板摘要）
  hint: string; // 类目说明（一句话）
  /** true = 可多选（只有「细节质感」需要叠加） */
  multi?: boolean;
  options: BuilderOption[];
}

export const BUILDER_CATEGORIES: BuilderCategory[] = [
  {
    id: "style",
    zh: "风格",
    en: "Style",
    hint: "决定画面整体气质，影响最大。",
    options: [
      { id: "photo", zh: "真实照片", desc: "现实世界的照片质感", en: "photorealistic" },
      { id: "portra", zh: "Kodak Portra 400", desc: "暖调胶片，细腻颗粒", en: "Kodak Portra 400 film look, warm tones, fine grain" },
      { id: "cinestill", zh: "Cinestill 800T", desc: "夜色胶片，红色光晕", en: "Cinestill 800T night film, red halation" },
      { id: "cinematic", zh: "电影静帧", desc: "像电影里的一帧", en: "cinematic film still" },
      { id: "bw", zh: "黑白", desc: "单色，只有光影与结构", en: "black and white, monochrome" },
      { id: "3d", zh: "3D 渲染", desc: "精修CG质感", en: "polished 3D render" },
      { id: "illustration", zh: "数字插画", desc: "干净的平涂色块", en: "digital illustration, clean flat color" },
      { id: "watercolor", zh: "水彩", desc: "柔和的水痕晕染", en: "watercolor painting, soft washes" },
      { id: "oil", zh: "油画", desc: "厚重的笔触堆叠", en: "oil painting, thick brushstrokes" },
      { id: "anime", zh: "日式动画", desc: "日式赛璐璐动画风", en: "anime style, Japanese animation" },
      { id: "pencil", zh: "铅笔素描", desc: "石墨线条", en: "pencil sketch, graphite lines" },
    ],
  },
  {
    id: "expr",
    zh: "表情",
    en: "Expression",
    hint: "画面里有人物时决定情绪。",
    options: [
      { id: "neutral", zh: "平静", desc: "放松、自然的状态", en: "neutral relaxed expression" },
      { id: "smile", zh: "温柔微笑", desc: "柔和温暖", en: "gentle soft smile" },
      { id: "laugh", zh: "开怀大笑", desc: "外放的笑意", en: "laughing openly, joyful" },
      { id: "smirk", zh: "自信浅笑", desc: "胸有成竹的半笑", en: "confident smirk" },
      { id: "serious", zh: "严肃", desc: "专注而坚定", en: "serious focused expression" },
      { id: "thoughtful", zh: "若有所思", desc: "沉浸在思绪里", en: "thoughtful, lost in thought" },
      { id: "serene", zh: "安然", desc: "闭眼、平和", en: "serene, eyes closed, at peace" },
      { id: "surprised", zh: "惊讶", desc: "睁大眼、微张嘴", en: "surprised, wide eyes" },
      { id: "worried", zh: "担忧", desc: "眉头紧锁，不安", en: "worried, tense brows" },
      { id: "melancholic", zh: "淡淡的忧伤", desc: "安静的情绪低落", en: "melancholic, quiet sadness" },
      { id: "angry", zh: "愤怒", desc: "皱眉，下颌紧绷", en: "angry, furrowed brows, tense jaw" },
      { id: "wink", zh: "俏皮眨眼", desc: "轻松、有互动感", en: "playful wink" },
    ],
  },
  {
    id: "camera",
    zh: "机身",
    en: "Camera",
    hint: "这张「照片」是用什么拍的。",
    options: [
      { id: "phone", zh: "手机", desc: "日常的手机随手拍", en: "shot on a smartphone" },
      { id: "phoneflash", zh: "夜间手机闪光", desc: "直闪，抓拍感", en: "direct phone flash at night, candid" },
      { id: "dslr", zh: "单反", desc: "经典的专业照片", en: "shot on a DSLR" },
      { id: "mirrorless", zh: "全画幅微单", desc: "现代、锐利、干净", en: "shot on a full-frame mirrorless camera" },
      { id: "medium", zh: "中画幅", desc: "杂志级丰富层次", en: "medium format, rich editorial tonality" },
      { id: "rangefinder", zh: "旁轴", desc: "街头纪实气质", en: "rangefinder, street documentary" },
      { id: "cinema", zh: "电影机", desc: "大银幕的观感", en: "shot on a cinema camera" },
      { id: "disposable", zh: "一次性相机", desc: "闪光灯、颗粒、怀旧", en: "disposable camera, flash, grain, nostalgic" },
      { id: "instant", zh: "拍立得", desc: "柔和褪色，梦境感", en: "instant film, soft faded dreamy" },
    ],
  },
  {
    id: "shot",
    zh: "景别",
    en: "Shot size",
    hint: "画面里能看到主体的多少。",
    options: [
      { id: "ecu", zh: "极致特写", desc: "只留一个细节，如眼睛", en: "extreme close-up on a single detail" },
      { id: "cu", zh: "特写", desc: "脸占满画面", en: "close-up, face fills the frame" },
      { id: "mcu", zh: "近景", desc: "头肩构图", en: "medium close-up, head and shoulders" },
      { id: "ms", zh: "中景", desc: "半身", en: "medium shot, waist up" },
      { id: "fs", zh: "全身", desc: "完整身形", en: "full body shot" },
      { id: "ws", zh: "远景", desc: "人物处在环境里", en: "wide shot, figure within surroundings" },
      { id: "est", zh: "定场", desc: "交代整个场景", en: "establishing shot of the location" },
    ],
  },
  {
    id: "angle",
    zh: "机位",
    en: "Angle",
    hint: "相机从哪里往哪里看。",
    options: [
      { id: "eye", zh: "平视", desc: "中性、自然", en: "eye level, natural" },
      { id: "low", zh: "低角度仰拍", desc: "从下往上看，显得有力量", en: "low angle looking up, powerful" },
      { id: "high", zh: "高角度俯拍", desc: "从上往下看，显得渺小", en: "high angle looking down" },
      { id: "bird", zh: "正俯视", desc: "垂直向下", en: "bird's-eye view, straight down" },
      { id: "worm", zh: "贴地视角", desc: "贴着地面往上", en: "worm's-eye view from the ground" },
      { id: "dutch", zh: "荷兰角", desc: "地平线倾斜，制造紧张", en: "dutch angle, tilted horizon, tension" },
      { id: "ots", zh: "过肩", desc: "越过一个人的肩膀", en: "over-the-shoulder angle" },
      { id: "aerial", zh: "航拍", desc: "从空中俯瞰", en: "aerial drone view" },
    ],
  },
  {
    id: "lens",
    zh: "镜头",
    en: "Lens",
    hint: "视野范围与透视关系。",
    options: [
      { id: "14", zh: "14mm 超广角", desc: "视野极大，边缘畸变", en: "14mm ultra-wide lens, distorted edges" },
      { id: "24", zh: "24mm 广角", desc: "风光与室内", en: "24mm wide angle lens" },
      { id: "35", zh: "35mm", desc: "街头纪实视角", en: "35mm lens, street documentary" },
      { id: "50", zh: "50mm", desc: "接近人眼所见", en: "50mm lens, natural perspective" },
      { id: "85", zh: "85mm 人像", desc: "经典人像焦段", en: "85mm portrait lens" },
      { id: "200", zh: "200mm 长焦", desc: "压缩空间，远景拉近", en: "200mm telephoto lens, compressed perspective" },
      { id: "macro", zh: "100mm 微距", desc: "放大微小细节", en: "100mm macro lens, tiny details" },
      { id: "fisheye", zh: "鱼眼", desc: "球形畸变", en: "fisheye lens, circular distortion" },
      { id: "tilt", zh: "移轴", desc: "微缩模型般的画面", en: "tilt-shift lens, toy-model world" },
    ],
  },
  {
    id: "aperture",
    zh: "景深",
    en: "Depth of field",
    hint: "背景有多虚。",
    options: [
      { id: "f14", zh: "f/1.4", desc: "背景强烈虚化", en: "f/1.4, very blurry background" },
      { id: "f28", zh: "f/2.8", desc: "背景柔和虚化", en: "f/2.8, soft background blur" },
      { id: "f56", zh: "f/5.6", desc: "虚实均衡", en: "f/5.6, balanced focus" },
      { id: "f11", zh: "f/11", desc: "前后都清晰", en: "f/11, everything sharp" },
    ],
  },
  {
    id: "motion",
    zh: "运动与快门",
    en: "Motion",
    hint: "动态是怎么被记录的。",
    options: [
      { id: "freeze", zh: "凝固瞬间", desc: "高速快门，动作清晰", en: "frozen motion, fast shutter, crisp action" },
      { id: "blur", zh: "动态模糊", desc: "运动被柔和地拖开", en: "motion blur, movement softly smeared" },
      { id: "pan", zh: "追焦摇摄", desc: "主体清晰，背景拉丝", en: "panning shot, sharp subject, streaked background" },
      { id: "longexp", zh: "长曝光", desc: "光轨、丝绢流水", en: "long exposure, light trails, silky motion" },
      { id: "multi", zh: "多重曝光", desc: "运动留下重影", en: "multiple exposure, ghosted repeats of movement" },
      { id: "double", zh: "双重曝光", desc: "两张影像叠在一起", en: "double exposure, two images blended" },
    ],
  },
  {
    id: "light",
    zh: "光线",
    en: "Lighting",
    hint: "光的形状、方向与颜色。",
    options: [
      { id: "golden", zh: "黄金时刻", desc: "低角度暖阳", en: "golden hour light, warm and low" },
      { id: "blue", zh: "蓝调时刻", desc: "日落后的蓝", en: "blue hour light, cool and calm" },
      { id: "softbox", zh: "影棚柔光箱", desc: "柔和平整", en: "studio softbox lighting, soft and even" },
      { id: "rembrandt", zh: "伦勃朗光", desc: "脸颊上的一小块三角光", en: "Rembrandt lighting, light triangle on the cheek" },
      { id: "split", zh: "阴阳分割光", desc: "半张脸埋进阴影", en: "split lighting, half the face in shadow" },
      { id: "butterfly", zh: "蝴蝶光", desc: "顶光， glamour 感", en: "butterfly lighting from above, glamour" },
      { id: "rim", zh: "轮廓光", desc: "边缘发亮，背景压暗", en: "rim light, glowing edge against a dark backdrop" },
      { id: "silhouette", zh: "逆光剪影", desc: "只见形态不见细节", en: "backlit silhouette" },
      { id: "overcast", zh: "阴天散射", desc: "柔和无阴影", en: "overcast light, cloudy, no hard shadows" },
      { id: "neon", zh: "霓虹", desc: "品红与青蓝", en: "neon lighting, magenta and cyan" },
      { id: "candle", zh: "烛光", desc: "温暖私密", en: "candlelight, warm and intimate" },
      { id: "hard", zh: "正午硬光", desc: "强烈生硬的阴影", en: "harsh midday sun, hard shadows" },
    ],
  },
  {
    id: "texture",
    zh: "细节与质感",
    en: "Detail",
    hint: "可多选。这些小细节最能说服眼睛。",
    multi: true,
    options: [
      { id: "pores", zh: "可见毛孔", desc: "真实的皮肤质地", en: "visible skin pores, real skin texture" },
      { id: "imperfect", zh: "自然瑕疵", desc: "雀斑、泛红、碎发", en: "natural imperfections, freckles, flyaway hairs" },
      { id: "fabric", zh: "织物纹理", desc: "针织、梭织、褶皱", en: "fabric texture, knit weave and folds" },
      { id: "grain", zh: "胶片颗粒", desc: "细微的模拟颗粒", en: "subtle film grain" },
      { id: "dust", zh: "光线里的尘埃", desc: "微粒被光照亮", en: "dust particles catching the light" },
      { id: "droplets", zh: "水珠", desc: "皮肤上的水或汗", en: "water droplets on skin" },
      { id: "wear", zh: "使用痕迹", desc: "划痕、磨损、岁月感", en: "wear and patina, scratches and scuffs" },
      { id: "sharp", zh: "极锐利细节", desc: "微观层次清晰可辨", en: "tack-sharp micro detail" },
    ],
  },
  {
    id: "mood",
    zh: "色调",
    en: "Palette",
    hint: "主色与整体调子。",
    options: [
      { id: "warm", zh: "暖调", desc: "琥珀与金", en: "warm palette, ambers and golds" },
      { id: "cool", zh: "冷调", desc: "蓝与钢灰", en: "cool palette, blues and steel" },
      { id: "pastel", zh: "柔和粉彩", desc: "轻盈的低饱和彩", en: "pastel palette, soft light colors" },
      { id: "muted", zh: "低饱和", desc: "克制的灰度", en: "muted desaturated palette" },
      { id: "vivid", zh: "高饱和", desc: "浓郁鲜艳", en: "vivid highly saturated colors" },
      { id: "contrast", zh: "高对比", desc: "深邃的黑", en: "high contrast, deep blacks" },
      { id: "moody", zh: "暗调", desc: "低调影调，情绪化", en: "moody low-key dark tones" },
      { id: "airy", zh: "明亮通透", desc: "高调、轻盈", en: "bright and airy high-key lighting" },
      { id: "teal", zh: "青橙对比", desc: "大片级调色", en: "teal and orange blockbuster grade" },
    ],
  },
  {
    id: "comp",
    zh: "构图",
    en: "Composition",
    hint: "主体在画面里放在哪。",
    options: [
      { id: "thirds", zh: "三分法", desc: "主体落在三分线上", en: "rule of thirds composition" },
      { id: "center", zh: "中心对称", desc: "正中的秩序感", en: "centered symmetrical composition" },
      { id: "leading", zh: "引导线", desc: "线条把视线带向主体", en: "leading lines guiding the eye" },
      { id: "negative", zh: "负空间", desc: "大量留白", en: "negative space, lots of empty space" },
      { id: "frame", zh: "框中框", desc: "借场景做画框", en: "frame within a frame" },
      { id: "diagonal", zh: "对角线", desc: "动感的斜线构图", en: "diagonal dynamic composition" },
    ],
  },
  {
    id: "ratio",
    zh: "画幅",
    en: "Aspect ratio",
    hint: "画面的形状。",
    options: [
      { id: "1-1", zh: "1:1 方画幅", desc: "方形", en: "1:1 square format" },
      { id: "4-5", zh: "4:5 竖版", desc: "适合信息流图文", en: "4:5 portrait format" },
      { id: "3-2", zh: "3:2 经典", desc: "传统照片比例", en: "3:2 classic photo format" },
      { id: "16-9", zh: "16:9 宽银幕", desc: "横向宽画幅", en: "16:9 widescreen format" },
      { id: "9-16", zh: "9:16 竖屏", desc: "短视频 / 故事式", en: "9:16 vertical story format" },
      { id: "21-9", zh: "21:9 电影宽幅", desc: "超宽电影感", en: "21:9 cinemascope format" },
    ],
  },
];

export type BuilderSelection = Record<string, string[]>;

/** 空选择（每类一个空数组）。 */
export function emptySelection(): BuilderSelection {
  return Object.fromEntries(BUILDER_CATEGORIES.map((c) => [c.id, []]));
}

/** 每类随机挑一项（多选类挑 2 项）——「Surprise me」用。 */
export function randomSelection(): BuilderSelection {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const sel: BuilderSelection = emptySelection();
  for (const c of BUILDER_CATEGORIES) {
    if (!c.options.length) continue;
    if (c.multi) {
      const pool = [...c.options];
      const n = Math.min(2, pool.length);
      const chosen: BuilderOption[] = [];
      for (let i = 0; i < n; i++) {
        chosen.push(pick(pool));
        pool.splice(pool.indexOf(chosen[i]), 1);
      }
      sel[c.id] = chosen.map((o) => o.id);
    } else {
      sel[c.id] = [pick(c.options).id];
    }
  }
  return sel;
}

const optionById = (catId: string, optId: string) =>
  BUILDER_CATEGORIES.find((c) => c.id === catId)?.options.find((o) => o.id === optId);

/** 已选摘要（按面板要展示的顺序）。 */
export function summaryOf(sel: BuilderSelection) {
  const out: { cat: BuilderCategory; opts: BuilderOption[] }[] = [];
  for (const c of BUILDER_CATEGORIES) {
    const opts = (sel[c.id] ?? []).map((id) => optionById(c.id, id)).filter(Boolean) as BuilderOption[];
    if (opts.length) out.push({ cat: c, opts });
  }
  return out;
}

/**
 * 把选择拼成一条自然语言英文提示词。
 * 顺序按「摄影工作流」：气质 → 机身 → 镜头 → 光圈 → 景别 → 机位 → 光 → 色调
 * → 构图 → 质感细节 → 运动 → 表情 → 画幅。
 */
export function buildPrompt(sel: BuilderSelection): string {
  const take = (id: string) =>
    (sel[id] ?? []).map((o) => optionById(id, o)?.en).filter(Boolean) as string[];

  const parts: string[] = [];
  parts.push(...take("style"));
  parts.push(...take("camera"));
  parts.push(...take("lens"));
  parts.push(...take("aperture"));
  parts.push(...take("shot"));
  parts.push(...take("angle"));
  parts.push(...take("light"));
  parts.push(...take("mood"));
  parts.push(...take("comp"));
  parts.push(...take("texture"));
  parts.push(...take("motion"));
  parts.push(...take("expr"));
  parts.push(...take("ratio"));

  if (!parts.length) return "";
  // 电影机 + 画幅之间加 shot on 的组合在 GPU 模型里更好读：这里简单用逗号连接并去重。
  const unique = [...new Set(parts)];
  return `${unique.join(", ")}.`;
}
