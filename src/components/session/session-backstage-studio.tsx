"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionBundle, SessionListItem } from "@/lib/session-service";
import type { StatusMetricDefinition } from "@/lib/status-metrics";
import {
  API_KEY_STORAGE_KEY,
  type CharacterDraft,
  type FeedbackTone,
  type NovelExportMode,
  createCharacterDrafts,
  createMetricDrafts,
  createPlayerProfileDraft,
  createWorldDraft,
  getModelLabel,
  parseRuntimeFacts,
  readJson,
} from "./session-client-shared";
import styles from "./session-shell.module.css";

type SessionBackstageStudioProps = {
  initialSession: SessionBundle;
  sessions: SessionListItem[];
  availableModels: string[];
};

function downloadMarkdown(fileName: string, markdown: string) {
  const url = window.URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function SessionBackstageStudio({
  initialSession,
  sessions: initialSessions,
  availableModels,
}: SessionBackstageStudioProps) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedModel, setSelectedModel] = useState(initialSession.model);
  const [novelExportMode, setNovelExportMode] = useState<NovelExportMode>("polished");
  const [novelExportTurns, setNovelExportTurns] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("这一页只负责配置、存档与导出，不打断聊天。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [isWorking, setIsWorking] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [worldDraft, setWorldDraft] = useState(() => createWorldDraft(initialSession));
  const [playerProfileDraft, setPlayerProfileDraft] = useState(() => createPlayerProfileDraft(initialSession));
  const [characterDrafts, setCharacterDrafts] = useState<CharacterDraft[]>(() => createCharacterDrafts(initialSession));
  const [statusMetricDrafts, setStatusMetricDrafts] = useState<StatusMetricDefinition[]>(() => createMetricDrafts(initialSession));

  useEffect(() => {
    const storedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeySaved(true);
    }
  }, []);

  useEffect(() => {
    setWorldDraft(createWorldDraft(session));
    setPlayerProfileDraft(createPlayerProfileDraft(session));
    setCharacterDrafts(createCharacterDrafts(session));
    setStatusMetricDrafts(createMetricDrafts(session));
    setSelectedModel(session.model);
  }, [session]);

  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1)),
    [sessions],
  );

  function updateFeedback(message: string, tone: FeedbackTone = "default") {
    setFeedback(message);
    setFeedbackTone(tone);
  }

  function saveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKeySaved(false);
      updateFeedback("本机 API Key 已清空。", "success");
      return;
    }
    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setApiKeySaved(true);
    updateFeedback("本机 API Key 已保存。", "success");
  }

  function clearApiKey() {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey("");
    setApiKeySaved(false);
    updateFeedback("本机 API Key 已移除。", "success");
  }

  async function saveCurrentSession() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存当前章节...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${session.id}`, { method: "PATCH" }),
      );
      setSession(payload.session);
      setSessions(payload.sessions);
      updateFeedback("当前章节已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存进度失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function createSession() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在创建新的剧情分支...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions: SessionListItem[] }>(
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel, worldId: session.world.id, isSaved: false }),
        }),
      );
      router.push(`/session/${payload.session.id}/backstage`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建分支失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteSession(sessionId: string) {
    const target = orderedSessions.find((item) => item.id === sessionId);
    if (!target || !window.confirm(`确认删除章节“${target.title}”吗？`)) return;

    setError(null);
    setIsWorking(true);

    try {
      const payload = await readJson<{ nextSession: SessionBundle | null; sessions: SessionListItem[] }>(
        await fetch(`/api/sessions/${sessionId}?hydrateNextSession=${sessionId === session.id ? "1" : "0"}`, {
          method: "DELETE",
        }),
      );

      if (sessionId === session.id && payload.nextSession) {
        router.push(`/session/${payload.nextSession.id}/backstage`);
        router.refresh();
        return;
      }

      setSessions(payload.sessions);
      updateFeedback("章节已删除。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除章节失败");
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
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerProfile: playerProfileDraft }),
        }),
      );
      setSession(payload.session);
      setSessions(payload.sessions);
      updateFeedback("主角设定已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存主角设定失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveWorldSettings() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存世界与导演配置...", "pending");
    try {
      const payload = await readJson<{ world: SessionBundle["world"] & { statusMetrics: StatusMetricDefinition[] } }>(
        await fetch(`/api/worlds/${session.world.id}`, {
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

      setSession((current) => ({
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
      updateFeedback("世界与导演配置已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存世界配置失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveModelSelection() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存当前模型选择...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle; sessions?: SessionListItem[] }>(
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel }),
        }),
      );
      setSession(payload.session);
      if (payload.sessions) setSessions(payload.sessions);
      updateFeedback("模型选择已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存模型失败");
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
    updateFeedback("正在保存角色设定...", "pending");
    try {
      const payload = await readJson<{ session?: SessionBundle }>(
        await fetch(`/api/characters/${characterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
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
              persistentFacts: {
                highPriority: parseRuntimeFacts(draft.highPriorityFactsText),
                standard: parseRuntimeFacts(draft.standardFactsText),
              },
            },
          }),
        }),
      );

      if (payload.session) {
        setSession(payload.session);
      }
      updateFeedback("角色设定已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存角色失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function createCharacter() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在新增角色...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle }>(
        await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            worldId: session.world.id,
            sessionId: session.id,
            name: "新角色",
            gender: "未知",
            roleLabel: "新登场角色",
          }),
        }),
      );
      setSession(payload.session);
      updateFeedback("新角色已加入。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "新增角色失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteCharacter(characterId: string) {
    const target = session.characters.find((character) => character.id === characterId);
    if (!target || !window.confirm(`确认删除角色“${target.name}”吗？`)) return;

    setError(null);
    setIsWorking(true);
    updateFeedback("正在删除角色...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle }>(
        await fetch(`/api/characters/${characterId}?sessionId=${session.id}`, { method: "DELETE" }),
      );
      setSession(payload.session);
      updateFeedback("角色已删除。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除角色失败");
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

  async function exportNovel() {
    setError(null);
    setIsWorking(true);
    updateFeedback(novelExportMode === "polished" ? "正在调用 AI 润色小说..." : "正在整理小说草稿...", "pending");
    try {
      const payload = await readJson<{ fileName: string; markdown: string; mode: NovelExportMode }>(
        await fetch(`/api/sessions/${session.id}/export-novel`, {
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
      setError(caughtError instanceof Error ? caughtError.message : "导出小说失败");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className={styles.backstageGrid}>
      <aside className={`${styles.panelSoft} ${styles.backstageSidebar}`}>
        <p className={styles.eyebrow}>后台导航</p>
        <a className={styles.anchorLink} href="#sessions">分支与存档</a>
        <a className={styles.anchorLink} href="#player">主角设定</a>
        <a className={styles.anchorLink} href="#world">世界与导演</a>
        <a className={styles.anchorLink} href="#metrics">状态栏</a>
        <a className={styles.anchorLink} href="#characters">角色设定</a>
        <a className={styles.anchorLink} href="#model">模型与密钥</a>
        <a className={styles.anchorLink} href="#export">导出</a>
        <span className={styles.statusBadge}>{error || feedback}</span>
        <span className={styles.pillNote}>{feedbackTone === "pending" ? "处理中" : feedbackTone === "success" ? "已更新" : "待操作"}</span>
      </aside>

      <div className={styles.backstageBody}>
        <section id="sessions" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>分支与存档</p>
              <h2 className={styles.sectionTitle}>把章节管理移出聊天页</h2>
              <p className={styles.sectionDescription}>这里负责创建新分支、保存当前进度、切换章节和删除旧线，不再挤占主聊天界面。</p>
            </div>
            <div className={styles.inlineActions}>
              <button className={styles.secondaryButton} type="button" onClick={saveCurrentSession} disabled={isWorking || session.isSaved}>
                {session.isSaved ? "已保存" : "保存当前章节"}
              </button>
              <button className={styles.primaryButton} type="button" onClick={createSession} disabled={isWorking}>
                新建分支
              </button>
            </div>
          </div>
          <div className={styles.sessionList}>
            {orderedSessions.map((item, index) => (
              <article key={item.id} className={styles.sessionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className={styles.sessionMeta}>
                      第 {index + 1} 章 / {getModelLabel(item.model)} / {item.isSaved ? "已存档" : "临时"}{item.id === session.id ? " / 当前" : ""}
                    </p>
                  </div>
                  <div className={styles.sessionActions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => router.push(`/session/${item.id}`)}>
                      打开聊天
                    </button>
                    <button className={styles.ghostButton} type="button" onClick={() => router.push(`/session/${item.id}/backstage`)}>
                      打开后台
                    </button>
                    <button className={styles.dangerButton} type="button" onClick={() => void deleteSession(item.id)} disabled={isWorking}>
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="player" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>主角设定</p>
              <h2 className={styles.sectionTitle}>把玩家入口做成真正可编辑的人设</h2>
            </div>
            <button className={styles.secondaryButton} onClick={savePlayerProfile} disabled={isWorking} type="button">
              保存
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.eyebrow}>显示名</span><input className={styles.input} value={playerProfileDraft.displayName} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>身份</span><input className={styles.input} value={playerProfileDraft.role} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, role: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>表层人设</span><textarea className={styles.textareaField} value={playerProfileDraft.publicPersona} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, publicPersona: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>背景</span><textarea className={styles.textareaField} value={playerProfileDraft.background} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, background: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>当前动机</span><textarea className={styles.textareaField} value={playerProfileDraft.motivation} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, motivation: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>说话风格</span><textarea className={styles.textareaField} value={playerProfileDraft.speakingStyle} onChange={(event) => setPlayerProfileDraft((current) => ({ ...current, speakingStyle: event.target.value }))} /></label>
          </div>
        </section>

        <section id="world" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>世界与导演</p>
              <h2 className={styles.sectionTitle}>把世界规则和节奏控制放到独立后台</h2>
            </div>
            <button className={styles.secondaryButton} onClick={saveWorldSettings} disabled={isWorking} type="button">
              保存
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.eyebrow}>世界名称</span><input className={styles.input} value={worldDraft.name} onChange={(event) => setWorldDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>世界简介</span><textarea className={styles.textareaField} value={worldDraft.description} onChange={(event) => setWorldDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>故事前提</span><textarea className={styles.textareaField} value={worldDraft.premise} onChange={(event) => setWorldDraft((current) => ({ ...current, premise: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>叙事规则</span><textarea className={styles.textareaField} value={worldDraft.storyGuide} onChange={(event) => setWorldDraft((current) => ({ ...current, storyGuide: event.target.value }))} /></label>
            <label className={styles.field}>
              <span className={styles.eyebrow}>推进速度</span>
              <select className={styles.select} value={worldDraft.directorConfig.pacing} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, pacing: event.target.value as typeof current.directorConfig.pacing } }))}>
                <option value="slow">慢热</option>
                <option value="balanced">均衡</option>
                <option value="fast">快节奏</option>
              </select>
            </label>
            <label className={styles.field}><span className={styles.eyebrow}>目标体验标签</span><input className={styles.input} value={worldDraft.directorConfig.beatLabel} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, beatLabel: event.target.value } }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>记忆检索条数</span><input className={styles.input} type="number" min={1} max={12} value={worldDraft.directorConfig.retrieval.memoryLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, memoryLimit: Number(event.target.value) || 1 } } }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>事实检索条数</span><input className={styles.input} type="number" min={1} max={12} value={worldDraft.directorConfig.retrieval.factLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, factLimit: Number(event.target.value) || 1 } } }))} /></label>
            <label className={styles.field}><span className={styles.eyebrow}>对话检索条数</span><input className={styles.input} type="number" min={2} max={12} value={worldDraft.directorConfig.retrieval.dialogueLimit} onChange={(event) => setWorldDraft((current) => ({ ...current, directorConfig: { ...current.directorConfig, retrieval: { ...current.directorConfig.retrieval, dialogueLimit: Number(event.target.value) || 2 } } }))} /></label>
          </div>
        </section>

        <section id="metrics" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>状态栏</p>
              <h2 className={styles.sectionTitle}>把节奏控制权给用户</h2>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={addStatusMetricDraft}>
              新增状态
            </button>
          </div>
          <div className={styles.formGrid}>
            {statusMetricDrafts.map((metric, index) => (
              <div key={`${metric.key}-${index}`} className={styles.metricEditorRow}>
                <label className={styles.field}><span className={styles.eyebrow}>状态 key</span><input className={styles.input} value={metric.key} onChange={(event) => updateStatusMetricDraft(index, { key: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.eyebrow}>显示名称</span><input className={styles.input} value={metric.label} onChange={(event) => updateStatusMetricDraft(index, { label: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.eyebrow}>满分</span><input className={styles.input} type="number" min={3} max={100} value={metric.max ?? 10} onChange={(event) => updateStatusMetricDraft(index, { max: Number(event.target.value) || 10 })} /></label>
                <button className={styles.dangerButton} type="button" onClick={() => removeStatusMetricDraft(index)}>删除</button>
              </div>
            ))}
          </div>
        </section>

        <section id="characters" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>角色设定</p>
              <h2 className={styles.sectionTitle}>角色卡与动态档案分开管理</h2>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={createCharacter} disabled={isWorking}>
              新增角色
            </button>
          </div>
          <div className={styles.stack}>
            {characterDrafts.map((draft) => (
              <article key={draft.id} className={styles.characterEditorCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>{draft.name || "未命名角色"}</strong>
                    <p className={styles.sessionMeta}>静态设定与动态状态都在这里编辑。</p>
                  </div>
                  <div className={styles.inlineActions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => void saveCharacterSettings(draft.id)} disabled={isWorking}>保存</button>
                    <button className={styles.dangerButton} type="button" onClick={() => void deleteCharacter(draft.id)} disabled={isWorking || session.characters.length <= 1}>删除</button>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}><span className={styles.eyebrow}>角色名称</span><input className={styles.input} value={draft.name} onChange={(event) => updateCharacterDraft(draft.id, { name: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>性别</span><input className={styles.input} value={draft.gender} onChange={(event) => updateCharacterDraft(draft.id, { gender: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>身份标签</span><input className={styles.input} value={draft.roleLabel} onChange={(event) => updateCharacterDraft(draft.id, { roleLabel: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>公开设定</span><textarea className={styles.textareaField} value={draft.publicSummary} onChange={(event) => updateCharacterDraft(draft.id, { publicSummary: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>隐藏动机</span><textarea className={styles.textareaField} value={draft.secretSummary} onChange={(event) => updateCharacterDraft(draft.id, { secretSummary: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>性格标签</span><input className={styles.input} value={draft.personalityTagsText} onChange={(event) => updateCharacterDraft(draft.id, { personalityTagsText: event.target.value })} /></label>
                  <div className={styles.sectionDivider} />
                  <label className={styles.field}><span className={styles.eyebrow}>当前身份</span><input className={styles.input} value={draft.currentIdentity} onChange={(event) => updateCharacterDraft(draft.id, { currentIdentity: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>当前关系</span><input className={styles.input} value={draft.currentRelationship} onChange={(event) => updateCharacterDraft(draft.id, { currentRelationship: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>对玩家态度</span><input className={styles.input} value={draft.attitudeTowardPlayer} onChange={(event) => updateCharacterDraft(draft.id, { attitudeTowardPlayer: event.target.value })} /></label>
                  <label className={styles.field}><span className={styles.eyebrow}>对玩家称呼</span><input className={styles.input} value={draft.playerAddress} onChange={(event) => updateCharacterDraft(draft.id, { playerAddress: event.target.value })} /></label>
                  <label className={styles.field}>
                    <span className={styles.eyebrow}>高优先级事实</span>
                    <textarea
                      className={styles.textareaField}
                      value={draft.highPriorityFactsText}
                      onChange={(event) => updateCharacterDraft(draft.id, { highPriorityFactsText: event.target.value })}
                      rows={4}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.eyebrow}>普通事实</span>
                    <textarea
                      className={styles.textareaField}
                      value={draft.standardFactsText}
                      onChange={(event) => updateCharacterDraft(draft.id, { standardFactsText: event.target.value })}
                      rows={4}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="model" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>模型与密钥</p>
              <h2 className={styles.sectionTitle}>模型切换归入后台，不再占住聊天主界面</h2>
            </div>
            <span className={styles.pillNote}>{apiKeySaved ? "本机 Key 已保存" : "尚未保存本机 Key"}</span>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.eyebrow}>当前模型</span>
              <select className={styles.select} value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={isWorking}>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {getModelLabel(model)}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.inlineActions}>
              <button className={styles.secondaryButton} type="button" onClick={saveModelSelection} disabled={isWorking}>
                保存当前模型
              </button>
            </div>
            <label className={styles.field}>
              <span className={styles.eyebrow}>DeepSeek API Key</span>
              <input className={styles.input} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="输入玩家自己的 DeepSeek Key" autoComplete="off" />
            </label>
            <div className={styles.inlineActions}>
              <button className={styles.secondaryButton} type="button" onClick={saveApiKey}>保存本机 Key</button>
              <button className={styles.ghostButton} type="button" onClick={clearApiKey}>清除</button>
            </div>
          </div>
        </section>

        <section id="export" className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>导出</p>
              <h2 className={styles.sectionTitle}>把章节整理成小说稿</h2>
            </div>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.eyebrow}>导出模式</span>
              <select className={styles.select} value={novelExportMode} onChange={(event) => setNovelExportMode(event.target.value as NovelExportMode)} disabled={isWorking}>
                <option value="polished">AI 润色导出</option>
                <option value="quick">快速草稿导出</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.eyebrow}>导出范围</span>
              <input className={styles.input} type="number" min={0} max={200} step={1} value={novelExportTurns} onChange={(event) => setNovelExportTurns(Math.max(0, Math.min(200, Number(event.target.value) || 0)))} disabled={isWorking} />
            </label>
            <div className={styles.inlineActions}>
              <button className={styles.primaryButton} type="button" onClick={exportNovel} disabled={isWorking || session.messages.length === 0}>
                导出 Markdown
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
