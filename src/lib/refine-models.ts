// 「用 AI 精炼」的模型清单：服务端配置 + 用户自己添加的模型。
//
// 设计对齐 D:\Mydata\hone\bun\hello-ai：
//   · 服务端默认模型只暴露「非密钥信息」（/api/refine/config），密钥留在服务端
//   · 用户也可以临时加自己的模型（baseUrl + 模型 ID + 可选密钥）
//   · 添加前先 /api/refine/verify 打一发真实请求验证，避免加了坏的
//
// ⚠ 用户填的密钥只存在**自己浏览器的 localStorage**，不进仓库、不进任何文件、不发给我。
//   留空则表示复用服务端环境变量里的密钥。
export interface RefineModel {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  /** 可留空 —— 留空则用服务端配置的密钥 */
  apiKey?: string;
}

export const SERVER_MODEL_ID = "server";

const KEY = "app:refine-models";

export function listModels(): RefineModel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === "string") : [];
  } catch {
    return [];
  }
}

function write(list: RefineModel[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式等写入失败时忽略 */
  }
}

export function addModel(m: Omit<RefineModel, "id">): RefineModel[] {
  const item: RefineModel = { ...m, id: `m_${Date.now().toString(36)}` };
  const next = [...listModels(), item];
  write(next);
  return next;
}

export function removeModel(id: string): RefineModel[] {
  const next = listModels().filter((m) => m.id !== id);
  write(next);
  return next;
}

export function findModel(id: string): RefineModel | null {
  if (id === SERVER_MODEL_ID) return null;
  return listModels().find((m) => m.id === id) ?? null;
}
