// 收藏以 localStorage 存储（无登录），并广播事件供 /saved 等页面即时更新。
const KEY = "app:saved";
const EVENT = "saved:change";

export function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isSaved(id: string): boolean {
  return getSaved().includes(id);
}

export function toggleSaved(id: string): boolean {
  const cur = getSaved();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 忽略写入失败（隐私模式等） */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, saved: next.includes(id) } }));
  }
  return next.includes(id);
}

export function onSavedChange(cb: (ids: string[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getSaved());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
