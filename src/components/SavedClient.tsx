"use client";

import { useEffect, useState } from "react";
import type { Prompt } from "@/lib/types";
import { GalleryClient } from "@/components/GalleryClient";
import { getSaved, onSavedChange } from "@/lib/saved";

// 收藏页的列表部分：收藏 id 存在 localStorage（无登录），
// 因此必须由**服务端**把 D1 里的全量数据传进来，客户端只负责按 id 过滤。
// ⚠ 之前这里直接拿 SEED_PROMPTS（本地 18 条种子）比对，图集里收藏的真实条目
//   根本不在那 18 条里，所以一个都显示不出来。
export function SavedClient({ prompts }: { prompts: Prompt[] }) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSavedIds(getSaved());
    setLoaded(true);
    const off = onSavedChange(setSavedIds);
    return () => off();
  }, []);

  const saved = prompts.filter((p) => savedIds.includes(p.id));

  if (!loaded) {
    return (
      <p className="mono py-20 text-center" style={{ color: "var(--faint)" }}>
        读取中…
      </p>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="serif" style={{ fontSize: 24, color: "var(--muted)" }}>
          还没有收藏
        </p>
        <p className="mono mt-3" style={{ color: "var(--faint)" }}>
          去 <a href="/gallery" style={{ color: "var(--accent)" }}>图集</a> 点「收藏」即可出现在这里
        </p>
      </div>
    );
  }

  // 复用图集的网格（自带点击弹窗）
  return <GalleryClient prompts={saved} />;
}
