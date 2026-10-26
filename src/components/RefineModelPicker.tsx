"use client";

import { useEffect, useId, useState } from "react";
import {
  SERVER_MODEL_ID,
  addModel,
  findModel,
  listModels,
  removeModel,
  type RefineModel,
} from "@/lib/refine-models";
import { showToast } from "@/lib/toast";

// 「用 AI 精炼」旁边的模型选择 / 添加。
// 服务端默认（Pages 环境变量）优先；用户也能加自己的模型并做连通性验证。

export function RefineModelPicker({
  value,
  onChange,
}: {
  value: string; // SERVER_MODEL_ID 或某个自定义模型的 id
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<RefineModel[]>([]);
  const [server, setServer] = useState<{ label: string; model: string; baseUrl: string } | null>(null);
  const [form, setForm] = useState({ label: "", baseUrl: "", model: "", apiKey: "" });
  const [busy, setBusy] = useState(false);
  const uid = useId();

  // 拉服务端默认模型的「非密钥」信息
  useEffect(() => {
    (async () => {
      try {
        const d = (await (await fetch("/api/refine/config")).json()) as {
          hasKey?: boolean;
          default?: { label: string; model: string; baseUrl: string } | null;
        };
        setServer(d.default ?? null);
      } catch {
        setServer(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (open) setModels(listModels());
  }, [open]);

  const currentLabel =
    value === SERVER_MODEL_ID
      ? server
        ? server.model
          ? `服务端 · ${server.model}`
          : "服务端配置"
        : "服务端配置（未设置）"
      : findModel(value)?.label ?? "自定义模型";

  async function verifyAndAdd() {
    const baseUrl = form.baseUrl.trim();
    const model = form.model.trim();
    if (!baseUrl || !model) {
      showToast("请填写 API 地址与模型 ID");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/refine/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, model, apiKey: form.apiKey.trim() || undefined }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!d.ok) {
        showToast(`验证失败：${[d.error, d.detail].filter(Boolean).join(" · ")}`.slice(0, 120));
        return;
      }
      setModels(
        addModel({
          label: form.label.trim() || model,
          baseUrl,
          model,
          apiKey: form.apiKey.trim() || undefined,
        })
      );
      setForm({ label: "", baseUrl: "", model: "", apiKey: "" });
      showToast("模型已添加");
    } catch {
      showToast("验证失败：网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mono cursor-pointer"
        style={{
          border: "1px solid var(--line-strong)",
          borderRadius: 999,
          padding: "7px 12px",
          color: "var(--paper-2)",
          background: "transparent",
          textTransform: "none",
        }}
        aria-expanded={open}
      >
        模型 · {currentLabel} {open ? "▴" : "▾"}
      </button>

      {open && (
        <div
          className="absolute left-0 z-[600] mt-2 w-[320px] rounded"
          style={{ background: "var(--ink-2)", border: "1px solid var(--line-strong)", padding: 14 }}
        >
          <span className="mono" style={{ color: "var(--faint)" }}>
            选择模型
          </span>

          <ul className="mt-2 flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => onChange(SERVER_MODEL_ID)}
                className="w-full cursor-pointer text-left"
                style={{
                  background: value === SERVER_MODEL_ID ? "var(--accent-soft)" : "transparent",
                  border: `1px solid ${value === SERVER_MODEL_ID ? "var(--accent)" : "transparent"}`,
                  borderRadius: 6,
                  padding: "7px 9px",
                }}
              >
                <span style={{ fontSize: 13, color: value === SERVER_MODEL_ID ? "var(--accent)" : "var(--paper-2)" }}>
                  服务端配置
                </span>
                <span className="block" style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                  {server ? `${server.model || "未指定模型"} · ${server.baseUrl}` : "未配置（见 Pages 环境变量）"}
                </span>
              </button>
            </li>

            {models.map((m) => (
              <li key={m.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(m.id)}
                  className="flex-1 cursor-pointer text-left"
                  style={{
                    background: value === m.id ? "var(--accent-soft)" : "transparent",
                    border: `1px solid ${value === m.id ? "var(--accent)" : "transparent"}`,
                    borderRadius: 6,
                    padding: "7px 9px",
                  }}
                >
                  <span style={{ fontSize: 13, color: value === m.id ? "var(--accent)" : "var(--paper-2)" }}>
                    {m.label}
                  </span>
                  <span className="block" style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                    {m.model} · {m.baseUrl}
                    {m.apiKey ? "" : " · 用服务端密钥"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = removeModel(m.id);
                    setModels(next);
                    if (value === m.id) onChange(SERVER_MODEL_ID);
                  }}
                  aria-label={`删除模型 ${m.label}`}
                  className="mono cursor-pointer"
                  style={{ color: "var(--faint)", background: "none", border: "none", padding: "4px 6px" }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
            <span className="mono" style={{ color: "var(--faint)" }}>
              添加模型
            </span>
            {(
              [
                ["label", "名称（可留空）"],
                ["baseUrl", "Base URL（如 https://…/v1）"],
                ["model", "模型 ID"],
                ["apiKey", "API Key（留空用服务端的）"],
              ] as const
            ).map(([k, ph]) => (
              <input
                key={k}
                id={`${uid}-${k}`}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                placeholder={ph}
                type={k === "apiKey" ? "password" : "text"}
                autoComplete="off"
                className="mt-2 w-full"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  color: "var(--paper)",
                  padding: "7px 9px",
                  fontSize: 12,
                }}
              />
            ))}
            <button
              type="button"
              onClick={verifyAndAdd}
              disabled={busy}
              className="mono mt-2 w-full cursor-pointer"
              style={{
                background: busy ? "transparent" : "var(--accent)",
                color: busy ? "var(--faint)" : "#141414",
                border: "1px solid var(--accent)",
                borderRadius: 999,
                padding: "8px 12px",
                textTransform: "none",
              }}
            >
              {busy ? "验证中…" : "验证并添加"}
            </button>
            <p style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.6, marginTop: 6 }}>
              密钥只存在你自己的浏览器，不进仓库。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
