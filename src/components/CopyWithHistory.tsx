"use client";

import { CopyButton } from "./CopyButton";
import { useHistory } from "@/lib/history-client";
import type { HistorySource } from "@/lib/history-store";

interface CopyWithHistoryProps {
  text: string;
  source: HistorySource;
  promptId?: string;
  promptSlug?: string | null;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

// 复制按钮 + 自动存历史：复制成功后把这条提示按来源记进历史（登录云端 / 未登录本机）。
export function CopyWithHistory({
  text,
  source,
  promptId,
  promptSlug,
  label = "复制",
  copiedLabel,
  className,
}: CopyWithHistoryProps) {
  const { save } = useHistory();
  return (
    <CopyButton
      text={text}
      label={label}
      copiedLabel={copiedLabel}
      className={className}
      onAfterCopy={() => void save(text, { source, promptId, promptSlug })}
    />
  );
}
