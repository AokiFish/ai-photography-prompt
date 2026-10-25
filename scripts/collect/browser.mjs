// 无头浏览器助手（Playwright）——专用于过 Cloudflare 质询采集 lexica.art。
//
// 为什么需要它：lexica.art 的官方搜索 API（/api/v1/search）对本机裸 fetch（数据中心 IP）
// 返回 500/524（Cloudflare 拦），但站点自身在浏览器里能正常调这个 API。
// 思路：起真实 Chromium → 访问 lexica 首页让 Cloudflare 质询通过（拿到 cf_clearance
// cookie）→ 之后用「浏览器内同源 fetch」调官方 API，同源且已清白，不再被拦。
//
// 本地若未装 playwright，动态 import 会失败 → 调用方自动回退普通 fetch（lexica 落 0 但不崩）。
// CI 里通过 workflow 的 `npm install --no-save playwright` + `playwright install chromium` 提供。

import { BROWSER_UA, sleep } from "./util.mjs";

let _browser = null;
let _ctx = null;
let _primed = false;
let _tried = false;

async function launch() {
  if (_tried) return _browser;
  _tried = true;
  try {
    const { chromium } = await import("playwright");
    _browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
    });
    _ctx = await _browser.newContext({
      userAgent: BROWSER_UA,
      viewport: { width: 1366, height: 900 },
      locale: "en-US",
    });
  } catch (e) {
    console.warn(`[browser] Playwright 不可用，lexica 将回退普通 fetch：${e.message}`);
    _browser = null;
  }
  return _browser;
}

// 访问 lexica 首页，等 Cloudflare 质询通过，建立可信 origin（拿到 cf_clearance）。
async function prime() {
  if (_primed) return;
  _primed = true; // 只试一次，避免 8 个 query 重复卡在质询
  if (!_ctx) return;
  const page = await _ctx.newPage();
  try {
    await page.goto("https://lexica.art/", { waitUntil: "domcontentloaded", timeout: 60000 });
    try {
      await page.waitForFunction(
        () => {
          const s = (document.title + " " + document.documentElement.innerHTML).toLowerCase();
          return !/just a moment|checking your browser|challenge|attention required|enable javascript and cookies/.test(s);
        },
        { timeout: 30000, polling: 1000 }
      );
    } catch {
      console.warn("[browser] 质询等待超时，仍尝试调 API（可能被拦）");
    }
    await sleep(800);
  } catch (e) {
    console.warn(`[browser] 首页访问失败：${e.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * 用浏览器内同源 fetch 调 lexica 官方搜索 API，绕开 Cloudflare 对裸 fetch 的拦截。
 * @returns {Promise<object|null>} API 的 JSON（含 images 数组）；不可用/失败返回 null。
 */
export async function lexicaSearch(q) {
  if (!(await launch()) || !_ctx) return null;
  await prime();
  const page = await _ctx.newPage();
  try {
    const data = await page.evaluate(async (query) => {
      const res = await fetch(
        "https://lexica.art/api/v1/search?q=" + encodeURIComponent(query),
        { headers: { accept: "application/json" } }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, q);
    const n = Array.isArray(data?.images) ? data.images.length : 0;
    console.log(`[lexica][browser] 搜索 "${q}" 取到 ${n} 条`);
    return data;
  } catch (e) {
    console.warn(`[lexica][browser] 搜索 "${q}" 失败: ${e.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (_browser) await _browser.close().catch(() => {});
  _browser = null;
  _ctx = null;
  _primed = false;
  _tried = false;
}
