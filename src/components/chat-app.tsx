"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { buildSessionDeletePlan, removeSessionFromList } from "@/lib/session-delete";
import { buildSessionUrl } from "@/lib/session-url";
import {
  DEFAULT_MINIMUM_REPLY_LENGTH,
  MINIMUM_REPLY_LENGTH_MAX,
  MINIMUM_REPLY_LENGTH_MIN,
  normalizeMinimumReplyLength,
} from "@/lib/config";
import { clampRelationshipMetric, getMetricMax, getRelationshipStage } from "@/lib/relationship-scale";
import type { AppBootstrap, SessionBundle, SessionListItem } from "@/lib/session-service";
import type { StatusMetricDefinition } from "@/lib/status-metrics";
import type { DirectorConfig, PlayerProfile } from "@/lib/story-director";

type ChatAppProps = {
  initialData: AppBootstrap;
  initialSessionId: string;
};

type FeedbackTone = "default" | "success" | "pending";
type DrawerView = "none" | "stage" | "backstage";
type NovelExportMode = "quick" | "polished";

type WorldDraft = {
  name: string;
  description: string;
  premise: string;
  storyGuide: string;
  directorConfig: DirectorConfig;
};

type PlayerProfileDraft = PlayerProfile;

type CharacterDraft = {
  id: string;
  name: string;
  gender: string;
  roleLabel: string;
  publicSummary: string;
  secretSummary: string;
  personalityTagsText: string;
  currentIdentity: string;
  currentRelationship: string;
  attitudeTowardPlayer: string;
  playerAddress: string;
  persistentFactsText: string;
};

const API_KEY_STORAGE_KEY = "moonlit_residence_deepseek_api_key";

const MODEL_LABELS: Record<string, string> = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
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
    directorConfig: session.world.directorConfig,
  };
}

function createPlayerProfileDraft(session: SessionBundle): PlayerProfileDraft {
  return { ...session.playerProfile };
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
    currentIdentity: character.runtimeState.currentIdentity.value,
    currentRelationship: character.runtimeState.currentRelationship.value,
    attitudeTowardPlayer: character.runtimeState.attitudeTowardPlayer.value,
    playerAddress: character.runtimeState.playerAddress.value,
    persistentFactsText: character.runtimeState.persistentFacts.value.join("\n"),
  }));
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data && typeof data.error === "string"
      ? data.error
      : "请求失败";
    throw new Error(message);
  }
  if (!data) throw new Error("服务端返回为空");
  return data;
}

function getPacingLabel(pacing: DirectorConfig["pacing"]) {
  if (pacing === "slow") return "慢热";
  if (pacing === "fast") return "快节奏";
  return "均衡";
}

function summarizePlayerProfile(profile: PlayerProfile) {
  return [profile.role, profile.publicPersona, profile.motivation].filter(Boolean).join(" · ");
}

export function ChatApp({ initialData, initialSessionId }: ChatAppProps) {
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>(initialData.sessions);
  const [activeSession, setActiveSession] = useState<SessionBundle>(initialData.activeSession);
  const [selectedModel, setSelectedModel] = useState(initialData.activeSession.model);
  const [input, setInput] = useState("");
  const [minimumReplyLength, setMinimumReplyLength] = useState(DEFAULT_MINIMUM_REPLY_LENGTH);
  const [novelExportMode, setNovelExportMode] = useState<NovelExportMode>("polished");
  const [novelExportTurns, setNovelExportTurns] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("舞台已就绪。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(initialSessionId);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [worldDraft, setWorldDraft] = useState<WorldDraft>(() => createWorldDraft(initialData.activeSession));
  const [playerProfileDraft, setPlayerProfileDraft] = useState<PlayerProfileDraft>(() => createPlayerProfileDraft(initialData.activeSession));
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
    setPlayerProfileDraft(createPlayerProfileDraft(activeSession));
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
      updateFeedback("新的临时剧情已创建。", "success");
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

  async function savePlayerProfile() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存主角设定...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${activeSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerProfile: playerProfileDraft }),
        }),
      );
      setActiveSession(payload.session);
      setSessions(payload.sessions);
      updateFeedback("主角设定已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存主角设定失败。");
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
      const payload = await readJson<{ world: SessionBundle["world"] & { statusMetrics: StatusMetricDefinition[]; directorConfig: DirectorConfig } }>(
        await fetch(`/api/worlds/${activeSession.world.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: worldDraft.name,
            description: worldDraft.description,
            premise: worldDraft.premise,
            storyGuide: worldDraft.storyGuide,
            statusMetrics: statusMetricDrafts,
            directorConfig: worldDraft.directorConfig,
          }),
        }),
      );
      setActiveSession((current) => ({
        ...current,
        world: {
          ...current.world,
          ...payload.world,
        },
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

  function parseRuntimeFacts(text: string) {
    return text
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function saveCharacterSettings(characterId: string) {
    const draft = characterDrafts.find((item) => item.id === characterId);
    if (!draft) return;
    setError(null);
    setIsWorking(true);
    try {
      const payload = await readJson<{ character: SessionBundle["characters"][number]; session?: SessionBundle }>(
        await fetch(`/api/characters/${characterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSession.id,
            name: draft.name,
            gender: draft.gender,
            roleLabel: draft.roleLabel,
            publicSummary: draft.publicSummary,
            secretSummary: draft.secretSummary,
            personalityTags: draft.personalityTagsText.split(/[、，,]/).map((item) => item.trim()).filter(Boolean),
            runtimeState: {
              currentIdentity: draft.currentIdentity,
              currentRelationship: draft.currentRelationship,
              attitudeTowardPlayer: draft.attitudeTowardPlayer,
              playerAddress: draft.playerAddress,
              persistentFacts: parseRuntimeFacts(draft.persistentFactsText),
            },
          }),
        }),
      );
      if (payload.session) {
        setActiveSession(payload.session);
      }
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
    setStatusMetricDrafts((current) => [...current, { key: `custom_${current.length + 1}`, label: "新状态", max: 10 }]);
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
          body: JSON.stringify({ content, model: selectedModel, apiKey: apiKey.trim() || undefined, minimumReplyLength }),
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

  function downloadMarkdown(fileName: string, markdown: string) {
    const url = window.URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function exportNovel() {
    setError(null);
    setIsWorking(true);
    updateFeedback(novelExportMode === "polished" ? "正在调用 AI 润色小说..." : "正在整理小说草稿...", "pending");
    try {
      const payload = await readJson<{ fileName: string; markdown: string; mode: NovelExportMode }>(
        await fetch(`/api/sessions/${activeSession.id}/export-novel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: novelExportMode,
            recentTurns: novelExportTurns > 0 ? novelExportTurns : undefined,
            apiKey: apiKey.trim() || undefined,
            model: selectedModel,
          }),
        }),
      );
      downloadMarkdown(payload.fileName, payload.markdown);
      updateFeedback(payload.mode === "polished" ? "AI 润色小说已导出。" : "小说草稿已导出。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "导出小说失败。");
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
      <main className="story-shell story-shell-rich">
        <aside className="story-sidebar">
          <section className="panel relationship-panel panel-elevated">
            <div className="section-header">
              <div>
                <p className="eyebrow">关系面板</p>
                <h2>角色温度</h2>
              </div>
              <button className="secondary-button" onClick={createSession} disabled={isWorking || Boolean(deletingSessionId)}>新分支</button>
            </div>

            <div className="relationship-focus">
              <span className="focus-label">主角档案</span>
              <strong>{activeSession.playerProfile.displayName}</strong>
              <p>{summarizePlayerProfile(activeSession.playerProfile) || "还没有为这一条剧情分支设定主角风格。"}</p>
            </div>

            <div className="relationship-stack">
              {activeSession.relationships.map((item) => {
                const character = activeSession.characters.find((entry) => entry.id === item.characterId);
                return (
                  <article key={item.id} className="relationship-card relationship-card-rich">
                    <div className="relationship-topline">
                      <div>
                        <strong>{item.character.name}</strong>
                        <p className="relationship-meta">{item.character.gender} / {character?.roleLabel || "关键角色"}</p>
                      </div>
                    </div>
                    <div className="metric-chip-row">
                      {activeSession.statusMetrics.map((metric) => {
                        const max = getMetricMax(metric);
                        const value = clampRelationshipMetric(item.metrics[metric.key] ?? 0, max);
                        return (
                          <div key={metric.key} className="metric-meter">
                            <div className="metric-meter-topline">
                              <span>{metric.label}</span>
                              <strong>{value}/{max}</strong>
                            </div>
                            <div className="metric-meter-track"><span className="metric-meter-fill" style={{ width: `${(value / max) * 100}%` }} /></div>
                            <span className="metric-stage">{getRelationshipStage(value, metric.key, max)}</span>
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
            <div className="section-header">
              <div>
                <p className="eyebrow">剧情分支</p>
                <h2>章节存档</h2>
              </div>
            </div>
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
          <section className="chat-stage panel story-stage-rich">
            <div className="scene-stage hero-stage">
              <div className="scene-copy">
                <p className="eyebrow">{activeSession.world.name}</p>
                <h2>{activeSession.sceneState.currentScene}</h2>
                <p className="scene-summary">{activeSession.sceneState.summary}</p>
                <div className="scene-detail-row">
                  <span className="scene-badge">{activeSession.sceneState.currentTime}</span>
                  <span className="scene-badge">{activeSession.sceneState.atmosphere}</span>
                  <span className="scene-badge">节奏：{getPacingLabel(activeSession.world.directorConfig.pacing)}</span>
                </div>
              </div>
              <div className="hero-stage-aside">
                <div className="memory-glance">
                  <span className="memory-label">RAG 记忆焦点</span>
                  <p>{latestMemory}</p>
                </div>
                <div className="hero-stage-profile">
                  <span className="memory-label">当前主角</span>
                  <strong>{activeSession.playerProfile.displayName}</strong>
                  <p>{activeSession.playerProfile.role}</p>
                </div>
              </div>
            </div>

            <div className="chat-toolbar">
              <div>
                <p className="eyebrow">叙事状态</p>
                <h2>本轮推进</h2>
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
                    <p>输入对白或行动，系统会结合主角档案、RAG 记忆与角色状态推进场景。</p>
                  </div>
                </div>
              ) : (
                <div className="conversation-flow">
                  {activeSession.messages.map((message) => {
                    const paragraphs = splitParagraphs(message.content);
                    if (message.role === "USER") {
                      return (
                        <article key={message.id} className="dialogue-row player-dialogue">
                          <div className="player-action-bubble player-action-bubble-rich">
                            <span>{activeSession.playerProfile.displayName} 的行动</span>
                            <p>{message.content}</p>
                          </div>
                        </article>
                      );
                    }
                    return (
                      <article key={message.id} className="dialogue-row assistant-dialogue">
                        <div className="assistant-story-text assistant-story-card">
                          {paragraphs.map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="action-strip">
              <span className="action-strip-label">你可以这样继续</span>
              {actionPrompts.map((prompt) => <button key={prompt} className="action-pill" type="button" onClick={() => setInput(prompt)} disabled={isWorking}>{prompt}</button>)}
            </div>

            <div className="composer">
              <div className="reply-length-control">
                <label>
                  <span>本轮最低字数</span>
                  <input
                    type="number"
                    min={MINIMUM_REPLY_LENGTH_MIN}
                    max={MINIMUM_REPLY_LENGTH_MAX}
                    step={100}
                    value={minimumReplyLength}
                    onChange={(event) => setMinimumReplyLength(normalizeMinimumReplyLength(Number(event.target.value)))}
                    disabled={isWorking}
                  />
                </label>
              </div>
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
          <section className="settings-section"><h3>主角档案快照</h3><p className="compact-text">{summarizePlayerProfile(activeSession.playerProfile)}</p></section>
        </div>
      </aside>

      <aside className={`settings-drawer settings-drawer-wide ${drawerView === "backstage" ? "open" : ""}`}>
        <div className="settings-drawer-header"><div><p className="eyebrow">设定与配置</p><h2>幕后工作台</h2></div><button className="ghost-button" type="button" onClick={() => setDrawerView("none")}>收起</button></div>
        <div className="settings-drawer-scroll">
          <section className="settings-section">
            <div className="subsection-header">
              <div>
                <h3>主角设定</h3>
                <p className="muted compact-text">每条剧情分支都可以单独定义主角身份、背景、目标与说话风格。</p>
              </div>
              <button className="secondary-button" onClick={savePlayerProfile} disabled={isWorking} type="button">保存</button>
            </div>
            <div className="form-stack">
              <label className="field-block"><span className="field-label">主角显示名</span><input className="api-key-input" value={playerProfileDraft.displayName} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">主角身份</span><input className="api-key-input" value={playerProfileDraft.role} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, role: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">表层人设</span><textarea value={playerProfileDraft.publicPersona} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, publicPersona: event.target.value }))} rows={2} /></label>
              <label className="field-block"><span className="field-label">背景</span><textarea value={playerProfileDraft.background} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, background: event.target.value }))} rows={2} /></label>
              <label className="field-block"><span className="field-label">当前动机</span><textarea value={playerProfileDraft.motivation} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, motivation: event.target.value }))} rows={2} /></label>
              <label className="field-block"><span className="field-label">说话风格</span><textarea value={playerProfileDraft.speakingStyle} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, speakingStyle: event.target.value }))} rows={2} /></label>
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>世界设定</h3><p className="muted compact-text">世界设定会影响当前世界下所有新旧剧情分支。</p></div><button className="secondary-button" onClick={saveWorldSettings} disabled={isWorking} type="button">保存</button></div>
            <div className="form-stack">
              <label className="field-block"><span className="field-label">世界名称</span><input className="api-key-input" value={worldDraft.name} onChange={(event) => setWorldDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">世界简介</span><textarea value={worldDraft.description} onChange={(event) => setWorldDraft((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
              <label className="field-block"><span className="field-label">故事前提</span><textarea value={worldDraft.premise} onChange={(event) => setWorldDraft((current) => ({ ...current, premise: event.target.value }))} rows={3} /></label>
              <label className="field-block"><span className="field-label">叙事规则</span><textarea value={worldDraft.storyGuide} onChange={(event) => setWorldDraft((current) => ({ ...current, storyGuide: event.target.value }))} rows={3} /></label>
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header">
              <div>
                <h3>导演节奏与 RAG</h3>
                <p className="muted compact-text">用节奏和检索窗口控制关系升温速度、信息密度和整体游戏时长。</p>
              </div>
            </div>
            <div className="form-stack">
              <label className="field-block">
                <span className="field-label">推进速度</span>
                <select className="api-key-input" value={worldDraft.directorConfig.pacing} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, pacing: event.target.value as DirectorConfig["pacing"] } }))}>
                  <option value="slow">慢热</option>
                  <option value="balanced">均衡</option>
                  <option value="fast">快节奏</option>
                </select>
              </label>
              <label className="field-block"><span className="field-label">目标体验标签</span><input className="api-key-input" value={worldDraft.directorConfig.beatLabel} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, beatLabel: event.target.value } }))} /></label>
              <div className="metric-editor-row metric-editor-row-three">
                <label className="field-block"><span className="field-label">记忆检索条数</span><input className="api-key-input" type="number" min={1} max={12} value={worldDraft.directorConfig.retrieval.memoryLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, memoryLimit: Number(event.target.value) || 1 } } }))} /></label>
                <label className="field-block"><span className="field-label">事实检索条数</span><input className="api-key-input" type="number" min={1} max={12} value={worldDraft.directorConfig.retrieval.factLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, factLimit: Number(event.target.value) || 1 } } }))} /></label>
                <label className="field-block"><span className="field-label">对话检索条数</span><input className="api-key-input" type="number" min={2} max={12} value={worldDraft.directorConfig.retrieval.dialogueLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, dialogueLimit: Number(event.target.value) || 2 } } }))} /></label>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>角色状态栏</h3><p className="muted compact-text">每个状态都可以独立设置上限，用来控制升温曲线与整体节奏。</p></div><button className="secondary-button" type="button" onClick={addStatusMetricDraft}>新增状态</button></div>
            <div className="form-stack">
              {statusMetricDrafts.map((metric, index) => (
                <div key={`${metric.key}-${index}`} className="metric-editor-row metric-editor-row-three">
                  <label className="field-block"><span className="field-label">状态 key</span><input className="api-key-input" value={metric.key} onChange={(event) => updateStatusMetricDraft(index, { key: event.target.value })} /></label>
                  <label className="field-block"><span className="field-label">显示名称</span><input className="api-key-input" value={metric.label} onChange={(event) => updateStatusMetricDraft(index, { label: event.target.value })} /></label>
                  <label className="field-block"><span className="field-label">满分</span><input className="api-key-input" type="number" min={3} max={100} value={metric.max ?? 10} onChange={(event) => updateStatusMetricDraft(index, { max: Number(event.target.value) || 10 })} /></label>
                  <button className="ghost-button danger-button metric-remove-button" type="button" onClick={() => removeStatusMetricDraft(index)}>删除</button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header">
              <div>
                <h3>角色设定</h3>
                <p className="muted compact-text">角色可新增、编辑或删除。手动修订后的不可遗忘事实不再冻结，AI 会继续补充新增事实。</p>
              </div>
              <button className="secondary-button" type="button" onClick={createCharacter} disabled={isWorking}>新增角色</button>
            </div>
            <div className="character-editor-list">
              {characterDrafts.map((draft) => (
                <div key={draft.id} className="character-editor-card">
                  <div className="subsection-header">
                    <h3>{draft.name || "未命名角色"}</h3>
                    <div className="inline-actions compact-actions">
                      <button className="secondary-button" type="button" onClick={() => saveCharacterSettings(draft.id)} disabled={isWorking}>保存</button>
                      <button className="ghost-button danger-button" type="button" onClick={() => deleteCharacter(draft.id)} disabled={isWorking || activeSession.characters.length <= 1}>删除</button>
                    </div>
                  </div>
                  <div className="form-stack">
                    <label className="field-block"><span className="field-label">角色名称</span><input className="api-key-input" value={draft.name} onChange={(event) => updateCharacterDraft(draft.id, { name: event.target.value })} /></label>
                    <label className="field-block"><span className="field-label">性别</span><input className="api-key-input" value={draft.gender} onChange={(event) => updateCharacterDraft(draft.id, { gender: event.target.value })} /></label>
                    <label className="field-block"><span className="field-label">身份标签</span><input className="api-key-input" value={draft.roleLabel} onChange={(event) => updateCharacterDraft(draft.id, { roleLabel: event.target.value })} /></label>
                    <label className="field-block"><span className="field-label">公开设定</span><textarea value={draft.publicSummary} onChange={(event) => updateCharacterDraft(draft.id, { publicSummary: event.target.value })} rows={2} /></label>
                    <label className="field-block"><span className="field-label">隐藏动机</span><textarea value={draft.secretSummary} onChange={(event) => updateCharacterDraft(draft.id, { secretSummary: event.target.value })} rows={2} /></label>
                    <label className="field-block"><span className="field-label">性格标签</span><input className="api-key-input" value={draft.personalityTagsText} onChange={(event) => updateCharacterDraft(draft.id, { personalityTagsText: event.target.value })} /></label>
                    <div className="runtime-state-panel">
                      <p className="field-label">当前动态档案</p>
                      <label className="field-block"><span className="field-label">当前身份</span><input className="api-key-input" value={draft.currentIdentity} onChange={(event) => updateCharacterDraft(draft.id, { currentIdentity: event.target.value })} /></label>
                      <label className="field-block"><span className="field-label">当前关系</span><input className="api-key-input" value={draft.currentRelationship} onChange={(event) => updateCharacterDraft(draft.id, { currentRelationship: event.target.value })} /></label>
                      <label className="field-block"><span className="field-label">对玩家态度</span><input className="api-key-input" value={draft.attitudeTowardPlayer} onChange={(event) => updateCharacterDraft(draft.id, { attitudeTowardPlayer: event.target.value })} /></label>
                      <label className="field-block"><span className="field-label">对玩家称呼</span><input className="api-key-input" value={draft.playerAddress} onChange={(event) => updateCharacterDraft(draft.id, { playerAddress: event.target.value })} /></label>
                      <label className="field-block"><span className="field-label">不可遗忘事实</span><textarea value={draft.persistentFactsText} onChange={(event) => updateCharacterDraft(draft.id, { persistentFactsText: event.target.value })} rows={4} placeholder="每行一条事实" /></label>
                      <p className="muted compact-text">用户手动修订的事实将被保留，后续 AI 只会补充新增事实，不会再把这一栏锁死。</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>模型与密钥</h3><p className="muted compact-text">网页密钥只保存在当前设备。</p></div><span className="status-pill">{apiKeySaved ? "网页密钥已保存" : "尚未保存密钥"}</span></div>
            <div className="form-stack"><label className="field-block"><span className="field-label">模型选择</span><select className="api-key-input" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={isWorking}>{initialData.availableModels.map((model) => <option key={model} value={model}>{getModelLabel(model)}</option>)}</select></label><label className="field-block"><span className="field-label">DeepSeek API Key</span><input className="api-key-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="输入玩家自己的 DeepSeek Key" autoComplete="off" /></label></div>
            <div className="inline-actions"><button className="secondary-button" onClick={saveApiKey} type="button">保存密钥</button><button className="ghost-button" onClick={clearApiKey} type="button">清除</button></div>
          </section>

          <section className="settings-section">
            <div className="subsection-header"><div><h3>导出为小说</h3><p className="muted compact-text">AI 润色会调用玩家自己的 DeepSeek API Key。</p></div></div>
            <div className="form-stack">
              <label className="field-block">
                <span className="field-label">导出模式</span>
                <select className="api-key-input" value={novelExportMode} onChange={(event) => setNovelExportMode(event.target.value as NovelExportMode)} disabled={isWorking}>
                  <option value="polished">AI 润色导出</option>
                  <option value="quick">快速草稿导出</option>
                </select>
              </label>
              <label className="field-block">
                <span className="field-label">导出范围</span>
                <input className="api-key-input" type="number" min={0} max={200} step={1} value={novelExportTurns} onChange={(event) => setNovelExportTurns(Math.max(0, Math.min(200, Number(event.target.value) || 0)))} disabled={isWorking} />
                <span className="muted compact-text">填 0 表示导出当前会话全部内容。</span>
              </label>
            </div>
            <div className="inline-actions"><button className="secondary-button" onClick={exportNovel} type="button" disabled={isWorking || activeSession.messages.length === 0}>导出 Markdown</button></div>
          </section>
        </div>
      </aside>
    </>
  );
}
