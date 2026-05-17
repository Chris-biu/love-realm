"use client";

import { useMemo, useState } from "react";
import type { SessionBundle, SessionListItem, WorldCardItem, WorldSelectionData } from "@/lib/session-service";
import styles from "./world-gateway.module.css";

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

type WorldGatewayProps = {
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
  return ["Moonlit", "Slowburn", "Velvet", "Secret"][index % 4];
}

export function WorldGateway({ initialData }: WorldGatewayProps) {
  const [data, setData] = useState(initialData);
  const [selectedWorldId, setSelectedWorldId] = useState(initialData.worlds[0]?.id ?? "");
  const [selectedModel, setSelectedModel] = useState(initialData.availableModels[0] || "deepseek-v4-flash");
  const [isCreating, setIsCreating] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("选择一个世界，进入一段可以长期推进的关系线。");
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

  const savedSessions = useMemo(
    () =>
      data.worlds.flatMap((world) =>
        world.savedSessions.map((save) => ({
          ...save,
          worldName: world.name,
        })),
      ),
    [data.worlds],
  );

  async function startWorld(worldId: string) {
    setError(null);
    setIsWorking(true);
    setFeedback("正在创建新的剧情入口...");

    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId, model: selectedModel, isSaved: false }),
        }),
      );

      window.location.href = `/session/${payload.session.id}`;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "进入世界失败");
      setIsWorking(false);
    }
  }

  function loadSave(sessionId: string) {
    window.location.href = `/session/${sessionId}`;
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
      setFeedback("存档已删除。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除存档失败");
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
      setFeedback("世界卡已创建，现在可以直接进入。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建世界失败");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <article className={styles.heroCard}>
          <p className={styles.eyebrow}>Love Realm</p>
          <h1 className={styles.title}>先选故事入口，再进入长期推进的剧情。</h1>
          <p className={styles.lead}>
            这里不再把世界选择、聊天、关系和后台配置挤在同一页。首页只负责一件事：帮你找到要进入的世界，然后把你送进最纯粹的聊天主界面。
          </p>
          <div className={styles.heroActions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => selectedWorld && startWorld(selectedWorld.id)}
              disabled={!selectedWorld || isWorking}
            >
              进入所选世界
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setIsCreating((current) => !current)}>
              {isCreating ? "收起新建表单" : "新建世界"}
            </button>
          </div>
        </article>

        <aside className={styles.heroAside}>
          <span className={styles.pill}>{savedSessions.length ? `已保存章节 ${savedSessions.length}` : "暂时没有已保存章节"}</span>
          <label className={styles.field}>
            <span className={styles.label}>本次进入时使用的模型</span>
            <select
              className={styles.select}
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
          <p className={styles.sectionCopy}>
            聊天页将默认聚焦剧情阅读与输入。关系、记忆、幕后设定与存档，都会进入独立页面处理。
          </p>
        </aside>
      </section>

      <section className={styles.shell}>
        <aside className={`${styles.panel} ${styles.rail}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.panelEyebrow}>世界书架</p>
              <h2 className={styles.sectionTitle}>故事入口</h2>
            </div>
          </div>
          <p className={styles.sectionCopy}>每个世界只负责提供设定、角色模板和进入剧情前的入口氛围。</p>
          <div className={styles.worldList}>
            {data.worlds.map((world, index) => (
              <button
                key={world.id}
                type="button"
                className={`${styles.worldCard} ${selectedWorld?.id === world.id ? styles.worldCardActive : ""}`}
                onClick={() => setSelectedWorldId(world.id)}
              >
                <span className={styles.worldTone}>{getWorldTone(index)}</span>
                <h3 className={styles.worldName}>{world.name}</h3>
                <p className={styles.worldMeta}>
                  {world.characterCount} 位角色 / {world.savedSessions.length} 个已保存章节
                </p>
              </button>
            ))}
          </div>
        </aside>

        <div className={styles.library}>
          {selectedWorld ? (
            <>
              <section className={`${styles.panel} ${styles.worldHero}`}>
                <div>
                  <p className={styles.panelEyebrow}>当前世界</p>
                  <h2 className={styles.worldHeroTitle}>{selectedWorld.name}</h2>
                  <p className={styles.worldHeroText}>{selectedWorld.description}</p>
                </div>
                <div className={styles.worldHeroMeta}>
                  <span className={styles.pill}>节奏 {selectedWorld.directorConfig.pacing}</span>
                  <span className={styles.pill}>体验 {selectedWorld.directorConfig.beatLabel}</span>
                  <button className={styles.primaryButton} type="button" onClick={() => startWorld(selectedWorld.id)} disabled={isWorking}>
                    从这里开始剧情
                  </button>
                </div>
              </section>

              <div className={styles.infoGrid}>
                <section className={styles.panel}>
                  <p className={styles.panelEyebrow}>开场场景</p>
                  <h3 className={styles.sectionTitle}>{selectedWorld.defaultScene}</h3>
                  <p className={styles.sectionCopy}>{selectedWorld.premise}</p>
                </section>

                <section className={styles.panel}>
                  <p className={styles.panelEyebrow}>默认主角入口</p>
                  <h3 className={styles.sectionTitle}>{selectedWorld.playerProfileTemplate.role}</h3>
                  <p className={styles.sectionCopy}>
                    默认会带入 {selectedWorld.playerProfileTemplate.displayName} 的身份进入剧情，后续可以在 backstage 页面里完全改写主角设定。
                  </p>
                </section>
              </div>

              <section className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>主要角色</p>
                    <h3 className={styles.sectionTitle}>进入前先看清舞台上的人</h3>
                  </div>
                </div>
                <div className={styles.characterGrid}>
                  {selectedWorld.characters.map((character) => (
                    <article key={character.id} className={styles.characterCard}>
                      <div className={styles.characterHead}>
                        <div className={styles.avatar}>{character.name.slice(0, 1)}</div>
                        <div>
                          <strong>{character.name}</strong>
                          <p className={styles.worldMeta}>{character.gender} / {character.roleLabel}</p>
                        </div>
                      </div>
                      <p className={styles.characterSummary}>{character.publicSummary}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.panelEyebrow}>已保存章节</p>
                <h3 className={styles.sectionTitle}>从上次停下的地方继续</h3>
              </div>
            </div>
            {savedSessions.length ? (
              <div className={styles.saveList}>
                {savedSessions.map((save) => (
                  <article key={save.id} className={styles.saveCard}>
                    <strong>{save.title}</strong>
                    <p className={styles.saveMeta}>
                      {save.worldName} / {save.turnCount} 轮 / {formatDate(save.updatedAt)} / {getModelLabel(save.model)}
                    </p>
                    <div className={styles.saveActions}>
                      <button className={styles.secondaryButton} type="button" onClick={() => loadSave(save.id)} disabled={isWorking}>
                        继续阅读
                      </button>
                      <button className={styles.ghostButton} type="button" onClick={() => deleteSave(save.id)} disabled={isWorking}>
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.sectionCopy}>当前还没有可继续的章节。进入剧情后保存进度，它就会出现在这里。</p>
            )}
          </section>

          {isCreating ? (
            <section className={`${styles.createCard}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelEyebrow}>新世界</p>
                  <h3 className={styles.sectionTitle}>创建一个新的故事入口</h3>
                </div>
                <button className={styles.ghostButton} type="button" onClick={() => setIsCreating(false)}>
                  取消
                </button>
              </div>
              <div className={styles.infoGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>世界名称</span>
                  <input
                    className={styles.input}
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="例如：雾港旧楼"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>默认开场场景</span>
                  <input
                    className={styles.input}
                    value={draft.defaultScene}
                    onChange={(event) => setDraft((current) => ({ ...current, defaultScene: event.target.value }))}
                    placeholder="例如：夜雨中的旧车站"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>世界简介</span>
                  <textarea
                    className={styles.textarea}
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="概括这个世界的气质、规则和情绪基调。"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>故事前提</span>
                  <textarea
                    className={styles.textarea}
                    value={draft.premise}
                    onChange={(event) => setDraft((current) => ({ ...current, premise: event.target.value }))}
                    placeholder="玩家为什么进入这里，最初面对什么关系张力。"
                  />
                </label>
              </div>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={createWorld} disabled={isWorking}>
                  {isWorking ? "创建中..." : "保存世界卡"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <p className={`${styles.feedback} ${error ? styles.feedbackError : ""}`}>{error || feedback}</p>
    </main>
  );
}
