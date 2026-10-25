let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("show"), 1600);
}
