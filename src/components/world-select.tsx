"use client";

import { useMemo, useState } from "react";
import type { SessionBundle, SessionListItem, WorldCardItem, WorldSelectionData } from "@/lib/session-service";

const MODEL_LABELS: Record<string, string> = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
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

function getWorldTone(index: number) {
  return ["潮声", "旧约", "秘密", "黄昏"][index % 4];
}

export function WorldSelect({ initialData }: WorldSelectProps) {
  const [data, setData] = useState(initialData);
  const [selectedWorldId, setSelectedWorldId] = useState(initialData.worlds[0]?.id ?? "");
  const [selectedModel, setSelectedModel] = useState(initialData.availableModels[0] || "deepseek-v4-flash");
  const [isCreating, setIsCreating] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("选择一个世界，读取一段关系，或者开始新的邂逅。");
  const [draft, setDraft] = useState<WorldDraft>({
    name: "",
    description: "",
    premise: "",
    defaultScene: "",
  });

  const selectedWorld = useMemo<WorldCardItem | undefined>(
    () => data.worlds.find((world) => world.id === selectedWorldId) ?? data.worlds[0],
    [data.worlds, selectedWorldId],
  );
  const recentSave = data.worlds.flatMap((world) => world.savedSessions.map((save) => ({ ...save, worldName: world.name }))).at(0);

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
      setError(caughtError instanceof Error ? caughtError.message : "开始剧情失败。");
      setIsWorking(false);
    }
  }

  function loadSave(sessionId: string) {
    window.location.href = `/?session=${sessionId}`;
  }

  async function deleteSave(sessionId: string) {
    const confirmed = window.confirm("确认删除这个存档吗？删除后无法恢复。");
    if (!confirmed) return;

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
      setFeedback("存档已删除。未保存的临时剧情不会出现在这里。");
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
      setSelectedWorldId(payload.worlds[0]?.id ?? "");
      setDraft({ name: "", description: "", premise: "", defaultScene: "" });
      setIsCreating(false);
      setFeedback("新的世界卡已创建，可以从书架进入。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建世界观失败。");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="world-library-shell world-library-shell-rich">
      <section className="world-library-hero world-library-hero-rich">
        <div>
          <p className="eyebrow">Love Realm</p>
          <h1>先搭好舞台，再进入一段会被记住的关系。</h1>
          <p>世界卡承载背景、角色、节奏规则和存档。现在你可以从入口就设定更长线的体验，而不只是随机进入一个简陋场景。</p>
        </div>
        <div className="world-quick-panel">
          <span className="status-pill">{recentSave ? `最近：${recentSave.worldName}` : "暂无已保存章节"}</span>
          <label className="field-block model-picker-inline">
            <span className="field-label">本次使用模型</span>
            <select className="api-key-input" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={isWorking}>
              {data.availableModels.map((model) => (
                <option key={model} value={model}>{getModelLabel(model)}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="button" onClick={() => selectedWorld && startWorld(selectedWorld.id)} disabled={!selectedWorld || isWorking}>
            进入所选世界
          </button>
        </div>
      </section>

      <section className="world-library-layout">
        <aside className="world-shelf panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">世界书架</p>
              <h2>故事入口</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => setIsCreating(true)}>新建</button>
          </div>
          <div className="world-shelf-list">
            {data.worlds.map((world, index) => (
              <button
                key={world.id}
                type="button"
                className={`world-spine ${selectedWorld?.id === world.id ? "active" : ""}`}
                onClick={() => setSelectedWorldId(world.id)}
              >
                <span>{getWorldTone(index)}</span>
                <strong>{world.name}</strong>
                <small>{world.characterCount} 位角色 / {world.savedSessions.length} 个存档</small>
              </button>
            ))}
          </div>
        </aside>

        {selectedWorld ? (
          <section className="world-detail-panel panel">
            <div className="world-detail-cover world-detail-cover-rich">
              <div>
                <p className="eyebrow">世界详情</p>
                <h2>{selectedWorld.name}</h2>
                <p>{selectedWorld.description}</p>
              </div>
              <div className="world-cover-meta">
                <span className="scene-badge">节奏：{selectedWorld.directorConfig.pacing}</span>
                <span className="scene-badge">体验：{selectedWorld.directorConfig.beatLabel}</span>
                <button className="primary-button" type="button" onClick={() => startWorld(selectedWorld.id)} disabled={isWorking}>
                  开始新的临时剧情
                </button>
              </div>
            </div>

            <div className="world-detail-grid">
              <section className="world-detail-section">
                <p className="eyebrow">开场舞台</p>
                <h3>{selectedWorld.defaultScene}</h3>
                <p>{selectedWorld.premise}</p>
              </section>

              <section className="world-detail-section">
                <p className="eyebrow">主角模板</p>
                <h3>{selectedWorld.playerProfileTemplate.role}</h3>
                <p>{selectedWorld.playerProfileTemplate.displayName} 将作为默认主角入口，你也可以在剧情内改成任意自定义人设。</p>
              </section>

              <section className="world-detail-section">
                <p className="eyebrow">主要角色</p>
                <div className="world-character-row">
                  {selectedWorld.characters.map((character) => (
                    <article key={character.id} className="world-character-card">
                      <div className="character-avatar-mark">{character.name.slice(0, 1)}</div>
                      <div>
                        <strong>{character.name}</strong>
                        <span>{character.gender} / {character.roleLabel}</span>
                      </div>
                      <p>{character.publicSummary}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section className="chapter-save-panel">
              <div className="save-slot-title">
                <span>章节存档</span>
                <span>{selectedWorld.savedSessions.length ? "选择一个分支继续" : "保存后会出现在这里"}</span>
              </div>
              {selectedWorld.savedSessions.length ? (
                selectedWorld.savedSessions.map((save, index) => (
                  <div key={save.id} className="chapter-save-row">
                    <button type="button" onClick={() => loadSave(save.id)} disabled={isWorking}>
                      <span>第 {index + 1} 章</span>
                      <strong>{save.title}</strong>
                      <small>{save.turnCount} 轮 / {formatDate(save.updatedAt)} / {getModelLabel(save.model)}</small>
                    </button>
                    <button className="ghost-button danger-button" type="button" onClick={() => deleteSave(save.id)} disabled={isWorking}>删除</button>
                  </div>
                ))
              ) : (
                <p className="muted compact-text">还没有可读取的章节。进入聊天后点击“保存进度”，它会成为这里的一条分支。</p>
              )}
            </section>
          </section>
        ) : null}
      </section>

      {isCreating ? (
        <section className="world-create-panel panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">新世界卡</p>
              <h2>写下一个可进入的故事舞台</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsCreating(false)}>取消</button>
          </div>
          <div className="world-create-grid">
            <label className="field-block">
              <span className="field-label">世界名称</span>
              <input className="api-key-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：雾港旧楼" />
            </label>
            <label className="field-block">
              <span className="field-label">默认开场场景</span>
              <input className="api-key-input" value={draft.defaultScene} onChange={(event) => setDraft((current) => ({ ...current, defaultScene: event.target.value }))} placeholder="例如：雨夜的旧车站" />
            </label>
            <label className="field-block">
              <span className="field-label">世界简介</span>
              <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="这个世界的整体气质和背景。" />
            </label>
            <label className="field-block">
              <span className="field-label">故事前提</span>
              <textarea value={draft.premise} onChange={(event) => setDraft((current) => ({ ...current, premise: event.target.value }))} rows={3} placeholder="玩家为什么进入这里，最初要面对什么。" />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="button" onClick={createWorld} disabled={isWorking}>
              {isWorking ? "创建中..." : "保存为世界卡"}
            </button>
          </div>
        </section>
      ) : null}

      <p className={`world-gate-feedback ${error ? "error" : ""}`}>{error || feedback}</p>
    </main>
  );
}
