"use client";

import { useState } from "react";
import type { SessionBundle, SessionListItem, WorldSelectionData } from "@/lib/session-service";

const MODEL_LABELS: Record<string, string> = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-chat": "旧版兼容：Chat",
  "deepseek-reasoner": "旧版兼容：Reasoner",
};

type WorldDraft = {
  name: string;
  description: string;
  premise: string;
  defaultScene: string;
};

type WorldSelectProps = {
  initialData: WorldSelectionData;
};

function getModelLabel(model: string) {
  return MODEL_LABELS[model] || model;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "请求失败";
    throw new Error(message);
  }

  if (!data) {
    throw new Error("服务端返回为空");
  }

  return data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WorldSelect({ initialData }: WorldSelectProps) {
  const [data, setData] = useState(initialData);
  const [selectedModel, setSelectedModel] = useState(initialData.availableModels[0] || "deepseek-v4-flash");
  const [isCreating, setIsCreating] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("选择一个世界，开始一段新的互动叙事。");
  const [draft, setDraft] = useState<WorldDraft>({
    name: "",
    description: "",
    premise: "",
    defaultScene: "",
  });

  async function startWorld(worldId: string) {
    setError(null);
    setIsWorking(true);
    setFeedback("正在打开新的临时剧情...");

    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId, model: selectedModel, isSaved: false }),
        }),
      );

      window.location.href = `/?session=${payload.session.id}`;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "开始聊天失败。");
      setIsWorking(false);
    }
  }

  function loadSave(sessionId: string) {
    window.location.href = `/?session=${sessionId}`;
  }

  async function deleteSave(sessionId: string) {
    const confirmed = window.confirm("确认删除这个存档吗？删除后无法恢复。");
    if (!confirmed) {
      return;
    }

    setError(null);
    setIsWorking(true);
    setFeedback("正在删除存档...");

    try {
      await readJson(
        await fetch(`/api/sessions/${sessionId}?hydrateNextSession=0`, {
          method: "DELETE",
        }),
      );
      const refreshed = await readJson<WorldSelectionData>(await fetch("/api/worlds", { cache: "no-store" }));
      setData(refreshed);
      setFeedback("存档已删除。未保存的临时剧情不会出现在这里。 ");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除存档失败。");
    } finally {
      setIsWorking(false);
    }
  }

  async function createWorld() {
    if (!draft.name.trim()) {
      setError("请至少填写世界名称。");
      return;
    }

    setError(null);
    setIsWorking(true);
    setFeedback("正在创建新的世界卡...");

    try {
      const payload = await readJson<WorldSelectionData>(
        await fetch("/api/worlds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      setData(payload);
      setDraft({ name: "", description: "", premise: "", defaultScene: "" });
      setIsCreating(false);
      setFeedback("新的世界卡已创建，可以从卡片进入聊天。 ");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建世界观失败。");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="world-gate-shell">
      <section className="world-gate-hero">
        <p className="eyebrow">互动叙事入口</p>
        <h1>选择一个世界，读取一段关系，或开始新的邂逅。</h1>
        <p>
          世界卡负责装载世界观、角色卡和统一状态栏。进入聊天后，只有点击保存进度的剧情才会成为可读档存档。
        </p>
        <div className="world-gate-actions">
          <label className="field-block model-picker-inline">
            <span className="field-label">本次使用模型</span>
            <select
              className="api-key-input"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={isWorking}
            >
              {data.availableModels.map((model) => (
                <option key={model} value={model}>
                  {getModelLabel(model)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="button" onClick={() => setIsCreating(true)}>
            创建世界观
          </button>
        </div>
        <p className={`world-gate-feedback ${error ? "error" : ""}`}>{error || feedback}</p>
      </section>

      {isCreating ? (
        <section className="world-create-panel panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">新世界卡</p>
              <h2>写下一个可进入的故事舞台</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsCreating(false)}>
              取消
            </button>
          </div>
          <div className="world-create-grid">
            <label className="field-block">
              <span className="field-label">世界名称</span>
              <input
                className="api-key-input"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：雾港旧梦"
              />
            </label>
            <label className="field-block">
              <span className="field-label">默认开场场景</span>
              <input
                className="api-key-input"
                value={draft.defaultScene}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, defaultScene: event.target.value }))
                }
                placeholder="例如：雨夜的旧车站"
              />
            </label>
            <label className="field-block">
              <span className="field-label">世界简介</span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                placeholder="这个世界的整体气质和背景。"
              />
            </label>
            <label className="field-block">
              <span className="field-label">故事前提</span>
              <textarea
                value={draft.premise}
                onChange={(event) => setDraft((current) => ({ ...current, premise: event.target.value }))}
                rows={3}
                placeholder="玩家为什么进入这里，最初要面对什么。"
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="button" onClick={createWorld} disabled={isWorking}>
              {isWorking ? "创建中..." : "保存为世界卡"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="world-card-grid">
        {data.worlds.map((world) => (
          <article key={world.id} className="world-card panel">
            <div className="world-card-cover">
              <span>{world.characterCount} 位角色</span>
            </div>
            <div className="world-card-body">
              <p className="eyebrow">世界卡</p>
              <h2>{world.name}</h2>
              <p>{world.description}</p>
              <div className="world-card-meta">
                <span>开场：{world.defaultScene}</span>
                <span>存档：{world.savedSessions.length} 个</span>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => startWorld(world.id)}
                disabled={isWorking}
              >
                开始新的临时剧情
              </button>
            </div>

            <div className="save-slot-list">
              <div className="save-slot-title">
                <span>读档</span>
                <span>只显示已保存进度</span>
              </div>
              {world.savedSessions.length ? (
                world.savedSessions.map((save) => (
                  <div key={save.id} className="save-slot-row">
                    <button type="button" onClick={() => loadSave(save.id)} disabled={isWorking}>
                      <strong>{save.title}</strong>
                      <span>
                        {save.turnCount} 轮 · {formatDate(save.updatedAt)} · {getModelLabel(save.model)}
                      </span>
                    </button>
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => deleteSave(save.id)}
                      disabled={isWorking}
                    >
                      删档
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted compact-text">还没有存档。进入聊天后点击“保存进度”才会出现在这里。</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}