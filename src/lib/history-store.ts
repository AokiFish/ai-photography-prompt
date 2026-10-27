// 提示词历史的本地存储（未登录）与登录合并逻辑。
// 纯模块（无 React / 无 JSX），可被 server（类型导入）、auth-client（触发合并）、history-client（useHistory）共用，
// 避免 auth-client 与 history-client 互相 import 形成循环依赖。

export type HistorySource = "refine" | "builder" | "gallery";

export interface LocalHistoryItem {
  id: string;
  promptId?: string;
  promptSlug?: string | null;
  promptText: string;
  source: HistorySource;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  text: string;
  source: HistorySource;
  createdAt: number;
  openHref?: string;
}

export const LOCAL_KEY = "aipp_history_local";
export const LOCAL_MAX = 20;

export function readLocalHistory(): LocalHistoryItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as LocalHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: LocalHistoryItem[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, LOCAL_MAX)));
}

// 入栈并去重：同 (promptId+source) 或同 (text+source) 视为同一条，移到最前、不重复计数。
function keyOf(i: LocalHistoryItem): string {
  return i.promptId ? `p:${i.promptId}:${i.source}` : `t:${i.promptText}:${i.source}`;
}

export function pushLocalHistory(item: LocalHistoryItem): void {
  const items = readLocalHistory();
  const k = keyOf(item);
  const filtered = items.filter((i) => keyOf(i) !== k);
  writeLocalHistory([item, ...filtered]);
}

// 登录后把本地 20 条按文本去重上传到云端，再清空本地（对应「登录时合并进云端」的需求）。
export async function mergeLocalHistoryToCloud(): Promise<void> {
  const local = readLocalHistory();
  if (!local.length) return;
  for (const it of local) {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: it.promptText, promptId: it.promptId, source: it.source }),
      });
    } catch {
      /* 单条失败忽略，继续其余 */
    }
  }
  if (typeof localStorage !== "undefined") localStorage.removeItem(LOCAL_KEY);
}
