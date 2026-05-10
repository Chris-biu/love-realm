"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RELATIONSHIP_MAX, clampRelationshipMetric, getRelationshipStage } from "@/lib/relationship-scale";
import { buildSessionDeletePlan, removeSessionFromList } from "@/lib/session-delete";
import { buildSessionUrl } from "@/lib/session-url";
import type { AppBootstrap, SessionBundle, SessionListItem } from "@/lib/session-service";
import type { StatusMetricDefinition } from "@/lib/status-metrics";

type ChatAppProps = {
  initialData: AppBootstrap;
  initialSessionId: string;
};

type FeedbackTone = "default" | "success" | "pending";
type DrawerView = "none" | "stage" | "backstage";

type WorldDraft = {
  name: string;
  description: string;
  premise: string;
  storyGuide: string;
};

type CharacterDraft = {
  id: string;
  name: string;
  gender: string;
  roleLabel: string;
  publicSummary: string;
  secretSummary: string;
  personalityTagsText: string;
};

const API_KEY_STORAGE_KEY = "moonlit_residence_deepseek_api_key";

const MODEL_LABELS: Record<string, string> = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-chat": "旧版兼容：Chat",
  "deepseek-reasoner": "旧版兼容：Reasoner",
};

const STARTER_PROMPTS = [
  "林月，你是不是一直在等我回来？",
  "今晚公馆里最不对劲的地方是什么？",
  "苏娅，今天餐厅里的气氛为什么这么安静？",
];

function getModelLabel(model: string) {
  return MODEL_LABELS[model] || "自定义模型";
}

function splitParagraphs(content: string) {
  return content.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function createWorldDraft(session: SessionBundle): WorldDraft {
  return {
    name: session.world.name,
    description: session.world.description,
    premise: session.world.premise,
    storyGuide: session.world.storyGuide,
  };
}

function createCharacterDrafts(session: SessionBundle): CharacterDraft[] {
  return session.characters.map((character) => ({
    id: character.id,
    name: character.name,
    gender: character.gender,
    roleLabel: character.roleLabel,
    publicSummary: character.publicSummary,
    secretSummary: character.secretSummary,
    personalityTagsText: character.personalityTags.join("、"),
  }));
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data && typeof data.error === "string" ? data.error : "请求失败";
    throw new Error(message);
  }
  if (!data) throw new Error("服务端返回为空");
  return data;
}

export function ChatApp({ initialData, initialSessionId }: ChatAppProps) {
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>(initialData.sessions);
  const [activeSession, setActiveSession] = useState<SessionBundle>(initialData.activeSession);
  const [selectedModel, setSelectedModel] = useState(initialData.activeSession.model);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("剧情舞台已就绪。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(initialSessionId);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [worldDraft, setWorldDraft] = useState<WorldDraft>(() => createWorldDraft(initialData.activeSession));
  const [characterDrafts, setCharacterDrafts] = useState<CharacterDraft[]>(() => createCharacterDrafts(initialData.activeSession));
  const [statusMetricDrafts, setStatusMetricDrafts] = useState<StatusMetricDefinition[]>(() => initialData.activeSession.statusMetrics.map((metric) => ({ ...metric })));
  const [drawerView, setDrawerView] = useState<DrawerView>("none");
  const [isWorking, setIsWorking] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingSessionId(null);
    const storedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeySaved(true);
    }
  }, []);

  useEffect(() => {
    setWorldDraft(createWorldDraft(activeSession));
    setCharacterDrafts(createCharacterDrafts(activeSession));
    setStatusMetricDrafts(activeSession.statusMetrics.map((metric) => ({ ...metric })));
  }, [activeSession]);

  useEffect(() => {
    chatStreamRef.current?.scrollTo({ top: chatStreamRef.current.scrollHeight, behavior: "smooth" });
  }, [activeSession.id, activeSession.messages]);

  const latestMemory = activeSession.memorySummaries.at(-1)?.content || "暂无长期记忆。";
  const actionPrompts = activeSession.suggestedPrompts.length ? activeSession.suggestedPrompts : STARTER_PROMPTS;

  function updateFeedback(message: string, tone: FeedbackTone = "default") {
    setFeedback(message);
    setFeedbackTone(tone);
  }

  function syncSessionUrl(sessionId: string) {
    window.history.replaceState(null, "", buildSessionUrl(window.location.href, sessionId));
  }

  function saveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKeySaved(false);
      updateFeedback("网页密钥已清空。", "success");
      return;
    }
    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setApiKeySaved(true);
    updateFeedback("网页密钥已保存。", "success");
  }

  function clearApiKey() {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey("");
    setApiKeySaved(false);
    updateFeedback("网页密钥已移除。", "success");
  }

  async function switchSession(sessionId: string) {
    setError(null);
    setIsWorking(true);
    setLoadingSessionId(sessionId);
    updateFeedback("正在切换剧情分支...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle }>(await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" }));
      setActiveSession(payload.session);
      setSelectedModel(payload.session.model);
      syncSessionUrl(payload.session.id);
      updateFeedback("剧情分支已切换。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "切换会话失败。");
    } finally {
      setLoadingSessionId(null);
      setIsWorking(false);
    }
  }

  async function createSession() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在创建新的临时剧情...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel, worldId: activeSession.world.id, isSaved: false }),
        }),
      );
      setSessions(payload.sessions);
      setActiveSession(payload.session);
      setSelectedModel(payload.session.model);
      syncSessionUrl(payload.session.id);
      updateFeedback("新的临时剧情已创建，保存后会成为章节分支。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建会话失败。");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveCurrentSession() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在写入这一段回忆...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${activeSession.id}`, { method: "PATCH" }),
      );
      setActiveSession(payload.session);
      setSessions(payload.sessions);
      updateFeedback("当前进度已保存为章节。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存进度失败。");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteSession(sessionId: string) {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target || !window.confirm(`确认删除剧情分支“${target.title}”吗？`)) return;
    const plan = buildSessionDeletePlan({ activeSessionId: activeSession.id, deletingSessionId: sessionId });
    const previousSessions = sessions;
    setDeletingSessionId(sessionId);
    setSessions(removeSessionFromList(previousSessions, sessionId));
    if (plan.deletingActiveSession) setIsWorking(true);
    try {
      const payload = await readJson<{ deletedSessionId: string; nextSession: SessionBundle | null; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${sessionId}?hydrateNextSession=${plan.hydrateNextSession ? "1" : "0"}`, { method: "DELETE" }),
      );
      setSessions(payload.sessions);
      if (plan.deletingActiveSession && payload.nextSession) {
        setActiveSession(payload.nextSession);
        setSelectedModel(payload.nextSession.model);
        syncSessionUrl(payload.nextSession.id);
      }
      updateFeedback("剧情分支已删除。", "success");
    } catch (caughtError) {
      setSessions(previousSessions);
      setError(caughtError instanceof Error ? caughtError.message : "删除剧情分支失败。");
    } finally {
      setDeletingSessionId(null);
      setIsWorking(false);
    }
  }

  async function saveWorldSettings() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存世界设定...", "pending");
    try {
      const payload = await readJson<{ world: SessionBundle["world"] & { statusMetrics: StatusMetricDefinition[] } }>(
        await fetch(`/api/worlds/${activeSession.world.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...worldDraft, statusMetrics: statusMetricDrafts }),
        }),
      );
      setActiveSession((current) => ({
        ...current,
        world: payload.world,
        statusMetrics: payload.world.statusMetrics,
        relationships: current.relationships.map((relationship) => ({
          ...relationship,
          metrics: Object.fromEntries(payload.world.statusMetrics.map((metric) => [metric.key, relationship.metrics[metric.key] ?? 0])),
        })),
      }));
      updateFeedback("世界设定已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存世界设定失败。");
    } finally {
      setIsWorking(false);
    }
  }

  function updateCharacterDraft(id: string, patch: Partial<CharacterDraft>) {
    setCharacterDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveCharacterSettings(characterId: string) {
    const draft = characterDrafts.find((item) => item.id === characterId);
    if (!draft) return;
    setError(null);
    setIsWorking(true);
    try {
      const payload = await readJson<{ character: SessionBundle["characters"][number] }>(
        await fetch(`/api/characters/${characterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            gender: draft.gender,
            roleLabel: draft.roleLabel,
            publicSummary: draft.publicSummary,
            secretSummary: draft.secretSummary,
            personalityTags: draft.personalityTagsText.split(/[、，,]/).map((item) => item.trim()).filter(Boolean),
          }),
        }),
      );
      setActiveSession((current) => ({
        ...current,
        characters: current.characters.map((item) => (item.id === characterId ? { ...item, ...payload.character } : item)),
        relationships: current.relationships.map((item) =>
          item.character.id === characterId ? { ...item, character: { ...item.character, name: payload.character.name, gender: payload.character.gender } } : item,
        ),
      }));
      updateFeedback("角色设定已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存角色失败。");
    } finally {
      setIsWorking(false);
    }
  }

  async function createCharacter() {
    setError(null);
    setIsWorking(true);
    try {
      const payload = await readJson<{ session: SessionBundle }>(
        await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId: activeSession.world.id, sessionId: activeSession.id, name: "新角色", gender: "未知", roleLabel: "新登场角色" }),
        }),
      );
      setActiveSession(payload.session);
      updateFeedback("新角色已加入。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "新增角色失败。");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteCharacter(characterId: string) {
    const target = activeSession.characters.find((character) => character.id === characterId);
    if (!target || !window.confirm(`确认删除角色“${target.name}”吗？`)) return;
    setError(null);
    setIsWorking(true);
    try {
      const payload = await readJson<{ session: SessionBundle }>(await fetch(`/api/characters/${characterId}?sessionId=${activeSession.id}`, { method: "DELETE" }));
      setActiveSession(payload.session);
      updateFeedback("角色已删除。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除角色失败。");
    } finally {
      setIsWorking(false);
    }
  }

  function updateStatusMetricDraft(index: number, patch: Partial<StatusMetricDefinition>) {
    setStatusMetricDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addStatusMetricDraft() {
    setStatusMetricDrafts((current) => [...current, { key: `custom_${current.length + 1}`, label: "新状态" }]);
  }

  function removeStatusMetricDraft(index: number) {
    setStatusMetricDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function sendMessage(prefill?: string) {
    const content = (prefill ?? input).trim();
    if (!content || isWorking) return;
    setError(null);
    setInput("");
    setIsWorking(true);
    updateFeedback("正在生成剧情...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${activeSession.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, model: selectedModel, apiKey: apiKey.trim() || undefined }),
        }),
      );
      setSessions(payload.sessions);
      setActiveSession(payload.session);
      setSelectedModel(payload.session.model);
      syncSessionUrl(payload.session.id);
      updateFeedback("场景已更新。", "success");
    } catch (caughtError) {
      setInput(content);
      setError(caughtError instanceof Error ? caughtError.message : "发送消息失败。");
    } finally {
      setIsWorking(false);
    }
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <main className="story-shell">
        <aside className="story-sidebar">
          <section className="panel relationship-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">关系状态</p>
                <h2>角色温度</h2>
              </div>
              <button className="secondary-button" onClick={createSession} disabled={isWorking || Boolean(deletingSessionId)}>新分支</button>
            </div>
            <div className="relationship-stack">
              {activeSession.relationships.map((item) => {
                const character = activeSession.characters.find((entry) => entry.id === item.characterId);
                return (
                  <article key={item.id} className="relationship-card">
                    <div className="relationship-topline">
                      <div>
                        <strong>{item.character.name}</strong>
                        <p className="relationship-meta">{item.character.gender} / {character?.roleLabel || "关键角色"}</p>
                      </div>
                    </div>
                    <div className="metric-chip-row">
                      {activeSession.statusMetrics.map((metric) => {
                        const value = clampRelationshipMetric(item.metrics[metric.key] ?? 0);
                        return (
                          <div key={metric.key} className="metric-meter">
                            <div className="metric-meter-topline">
                              <span>{metric.label}</span>
                              <strong>{value}/{RELATIONSHIP_MAX}</strong>
                            </div>
                            <div className="metric-meter-track"><span className="metric-meter-fill" style={{ width: `${(value / RELATIONSHIP_MAX) * 100}%` }} /></div>
                            <span className="metric-stage">{getRelationshipStage(value, metric.key)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel session-panel">
            <div className="section-header"><div><p className="eyebrow">剧情分支</p><h2>章节存档</h2></div></div>
            <div className="session-list">
              {sessions.map((session, index) => (
                <div key={session.id} className="session-row">
                  <button className={`session-item ${session.id === activeSession.id ? "active" : ""}`} onClick={() => switchSession(session.id)} disabled={loadingSessionId === session.id || isWorking || Boolean(deletingSessionId)}>
                    <span>第 {index + 1} 章</span>
                    <strong>{session.title}</strong>
                    <small>{loadingSessionId === session.id ? "切换中..." : `${getModelLabel(session.model)} / ${session.isSaved ? "已存档" : "临时"}`}</small>
                  </button>
                  <button className="session-delete-button" type="button" onClick={() => deleteSession(session.id)} disabled={Boolean(deletingSessionId) || isWorking}>
                    {deletingSessionId === session.id ? "删除中..." : "删除"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="story-main">
          <section className="chat-stage panel">
            <div className="chat-toolbar">
              <div>
                <p className="eyebrow">{activeSession.world.name}</p>
                <h2>{activeSession.sceneState.currentScene}</h2>
              </div>
              <div className="chat-toolbar-actions">
                <span className={`inline-status ${feedbackTone}`}>{error || feedback}</span>
                <button className="ghost-button" type="button" onClick={() => setDrawerView("stage")}>回忆</button>
                <button className="ghost-button" type="button" onClick={saveCurrentSession} disabled={isWorking || activeSession.isSaved}>{activeSession.isSaved ? "已存档" : "保存"}</button>
                <button className="ghost-button" type="button" onClick={() => { window.location.href = "/"; }}>书架</button>
                <button className="ghost-button" type="button" onClick={() => setDrawerView("backstage")}>幕后</button>
              </div>
            </div>

            <div ref={chatStreamRef} className="chat-stream narrative-stream">
              {activeSession.messages.length === 0 ? (
                <div className="empty-state narrative-empty">
                  <div className="empty-copy">
                    <h3>从一句试探开始。</h3>
                    <p>输入对白或行动，系统会推进场景、关系和记忆。</p>
                  </div>
                </div>
              ) : (
                <div className="conversation-flow">
                  {activeSession.messages.map((message) => {
                    const paragraphs = splitParagraphs(message.content);
                    if (message.role === "USER") {
                      return (
                        <article key={message.id} className="dialogue-row player-dialogue">
                          <div className="player-action-bubble">
                            <span>你的行动</span>
                            <p>{message.content}</p>
                          </div>
                        </article>
                      );
                    }
                    return (
                      <article key={message.id} className="dialogue-row assistant-dialogue">
                        <div className="assistant-story-text">
                          {paragraphs.map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="action-strip"><span className="action-strip-label">可以这样继续</span>{actionPrompts.map((prompt) => <button key={prompt} className="action-pill" type="button" onClick={() => setInput(prompt)} disabled={isWorking}>{prompt}</button>)}</div>
            <div className="composer">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="输入一句自然语言..." rows={4} disabled={isWorking} />
              <div className="composer-footer"><span className="muted">{isWorking ? "正在生成剧情..." : "Enter 发送，Shift + Enter 换行。"}</span><button className="primary-button" onClick={() => sendMessage()} disabled={isWorking || !input.trim()}>{isWorking ? "生成中..." : "发送剧情"}</button></div>
            </div>
          </section>
        </section>
      </main>

      <div className={`console-backdrop ${drawerView !== "none" ? "open" : ""}`} onClick={() => setDrawerView("none")} aria-hidden={drawerView === "none"} />
      <aside className={`stage-info-drawer ${drawerView === "stage" ? "open" : ""}`}>
        <div className="settings-drawer-header"><div><p className="eyebrow">回忆与场景</p><h2>{activeSession.world.name}</h2></div><button className="ghost-button" type="button" onClick={() => setDrawerView("none")}>收起</button></div>
        <div className="settings-drawer-scroll">
          <section className="settings-section"><h3>当前场景</h3><div className="scene-copy"><h2>{activeSession.sceneState.currentScene}</h2><p className="scene-summary">{activeSession.sceneState.summary}</p><div className="scene-detail-row"><span className="scene-badge">时间：{activeSession.sceneState.currentTime}</span><span className="scene-badge">氛围：{activeSession.sceneState.atmosphere}</span></div></div></section>
          <section className="settings-section"><h3>长期记忆</h3><p className="compact-text">{latestMemory}</p></section>
          <section className="settings-section"><h3>世界前提</h3><p className="compact-text">{activeSession.world.premise}</p></section>
        </div>
      </aside>

      <aside className={`settings-drawer ${drawerView === "backstage" ? "open" : ""}`}>
        <div className="settings-drawer-header"><div><p className="eyebrow">设定与配置</p><h2>幕后工作台</h2></div><button className="ghost-button" type="button" onClick={() => setDrawerView("none")}>收起</button></div>
        <div className="settings-drawer-scroll">
          <section className="settings-section">
            <div className="subsection-header"><div><h3>世界设定</h3><p className="muted compact-text">修改后影响后续剧情生成。</p></div><button className="secondary-button" onClick={saveWorldSettings} disabled={isWorking} type="button">保存</button></div>
            <div className="form-stack">
              <label className="field-block"><span className="field-label">世界名称</span><input className="api-key-input" value={worldDraft.name} onChange={(event) => setWorldDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">世界简介</span><textarea value={worldDraft.description} onChange={(event) => setWorldDraft((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
              <label className="field-block"><span className="field-label">故事前提</span><textarea value={worldDraft.premise} onChange={(event) => setWorldDraft((current) => ({ ...current, premise: event.target.value }))} rows={3} /></label>
              <label className="field-block"><span className="field-label">叙事规则</span><textarea value={worldDraft.storyGuide} onChange={(event) => setWorldDraft((current) => ({ ...current, storyGuide: event.target.value }))} rows={3} /></label>
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>角色状态栏</h3><p className="muted compact-text">同一世界角色共用这套状态栏。</p></div><button className="secondary-button" type="button" onClick={addStatusMetricDraft}>新增状态</button></div>
            <div className="form-stack">{statusMetricDrafts.map((metric, index) => <div key={`${metric.key}-${index}`} className="metric-editor-row"><label className="field-block"><span className="field-label">状态 key</span><input className="api-key-input" value={metric.key} onChange={(event) => updateStatusMetricDraft(index, { key: event.target.value })} /></label><label className="field-block"><span className="field-label">显示名称</span><input className="api-key-input" value={metric.label} onChange={(event) => updateStatusMetricDraft(index, { label: event.target.value })} /></label><button className="ghost-button danger-button" type="button" onClick={() => removeStatusMetricDraft(index)}>删除</button></div>)}</div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>角色设定</h3><p className="muted compact-text">角色可新增、编辑或删除。</p></div><button className="secondary-button" type="button" onClick={createCharacter} disabled={isWorking}>新增角色</button></div>
            <div className="character-editor-list">{characterDrafts.map((draft) => <div key={draft.id} className="character-editor-card"><div className="subsection-header"><h3>{draft.name || "未命名角色"}</h3><div className="inline-actions compact-actions"><button className="secondary-button" type="button" onClick={() => saveCharacterSettings(draft.id)} disabled={isWorking}>保存</button><button className="ghost-button danger-button" type="button" onClick={() => deleteCharacter(draft.id)} disabled={isWorking || activeSession.characters.length <= 1}>删除</button></div></div><div className="form-stack"><label className="field-block"><span className="field-label">角色名称</span><input className="api-key-input" value={draft.name} onChange={(event) => updateCharacterDraft(draft.id, { name: event.target.value })} /></label><label className="field-block"><span className="field-label">性别</span><input className="api-key-input" value={draft.gender} onChange={(event) => updateCharacterDraft(draft.id, { gender: event.target.value })} /></label><label className="field-block"><span className="field-label">身份标签</span><input className="api-key-input" value={draft.roleLabel} onChange={(event) => updateCharacterDraft(draft.id, { roleLabel: event.target.value })} /></label><label className="field-block"><span className="field-label">公开设定</span><textarea value={draft.publicSummary} onChange={(event) => updateCharacterDraft(draft.id, { publicSummary: event.target.value })} rows={2} /></label><label className="field-block"><span className="field-label">隐藏动机</span><textarea value={draft.secretSummary} onChange={(event) => updateCharacterDraft(draft.id, { secretSummary: event.target.value })} rows={2} /></label><label className="field-block"><span className="field-label">性格标签</span><input className="api-key-input" value={draft.personalityTagsText} onChange={(event) => updateCharacterDraft(draft.id, { personalityTagsText: event.target.value })} /></label></div></div>)}</div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>模型与密钥</h3><p className="muted compact-text">网页密钥只保存在当前设备。</p></div><span className="status-pill">{apiKeySaved ? "网页密钥已保存" : "尚未保存密钥"}</span></div>
            <div className="form-stack"><label className="field-block"><span className="field-label">模型选择</span><select className="api-key-input" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={isWorking}>{initialData.availableModels.map((model) => <option key={model} value={model}>{getModelLabel(model)}</option>)}</select></label><label className="field-block"><span className="field-label">DeepSeek API Key</span><input className="api-key-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="输入玩家自己的 DeepSeek Key" autoComplete="off" /></label></div>
            <div className="inline-actions"><button className="secondary-button" onClick={saveApiKey} type="button">保存密钥</button><button className="ghost-button" onClick={clearApiKey} type="button">清除</button></div>
          </section>
        </div>
      </aside>
    </>
  );
}
