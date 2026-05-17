"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { DEFAULT_MINIMUM_REPLY_LENGTH, normalizeMinimumReplyLength } from "@/lib/config";
import type { SessionBundle } from "@/lib/session-service";
import {
  API_KEY_STORAGE_KEY,
  type FeedbackTone,
  STARTER_PROMPTS,
  getPacingLabel,
  readJson,
  splitParagraphs,
} from "./session-client-shared";
import styles from "./session-shell.module.css";

type SessionChatWorkspaceProps = {
  initialSession: SessionBundle;
};

const LENGTH_PRESETS = [
  { label: "短", value: 500 },
  { label: "中", value: DEFAULT_MINIMUM_REPLY_LENGTH },
  { label: "长", value: 1400 },
];

export function SessionChatWorkspace({ initialSession }: SessionChatWorkspaceProps) {
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const [session, setSession] = useState<SessionBundle>(initialSession);
  const [input, setInput] = useState("");
  const [minimumReplyLength, setMinimumReplyLength] = useState(DEFAULT_MINIMUM_REPLY_LENGTH);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("舞台已经准备好。");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [isWorking, setIsWorking] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  useEffect(() => {
    const storedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeySaved(true);
    }
  }, []);

  useEffect(() => {
    chatStreamRef.current?.scrollTo({ top: chatStreamRef.current.scrollHeight, behavior: "smooth" });
  }, [session.messages]);

  const actionPrompts = session.suggestedPrompts.length ? session.suggestedPrompts : STARTER_PROMPTS;
  const statusCopy =
    error || feedbackTone === "pending"
      ? error || feedback
      : apiKeySaved
        ? "本机 DeepSeek Key 已就绪"
        : "未在本机保存 DeepSeek Key";

  function updateFeedback(message: string, tone: FeedbackTone = "default") {
    setFeedback(message);
    setFeedbackTone(tone);
  }

  async function saveSession() {
    setError(null);
    setIsWorking(true);
    updateFeedback("正在保存这一条章节线...", "pending");
    try {
      const payload = await readJson<{ session: SessionBundle }>(await fetch(`/api/sessions/${session.id}`, { method: "PATCH" }));
      setSession(payload.session);
      updateFeedback("当前章节已保存。", "success");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存进度失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function sendMessage(prefill?: string) {
    const content = (prefill ?? input).trim();
    if (!content || isWorking) return;

    setError(null);
    setInput("");
    setIsWorking(true);
    updateFeedback("正在生成剧情...", "pending");

    try {
      const payload = await readJson<{ session: SessionBundle }>(
        await fetch(`/api/sessions/${session.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            model: session.model,
            apiKey: apiKey.trim() || undefined,
            minimumReplyLength,
          }),
        }),
      );

      setSession(payload.session);
      updateFeedback("场景已推进。", "success");
    } catch (caughtError) {
      setInput(content);
      setError(caughtError instanceof Error ? caughtError.message : "发送消息失败");
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
    <section className={`${styles.panel} ${styles.chatSurface}`}>
      <div className={`${styles.hero} ${heroCollapsed ? styles.heroCollapsed : ""}`}>
        <div className={styles.heroBar}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{session.world.name}</p>
            <h2 className={styles.heroTitle}>{session.sceneState.currentScene}</h2>
          </div>
          <div className={styles.heroBarActions}>
            <div className={styles.chipRow}>
              <span className={styles.chip}>{session.sceneState.currentTime}</span>
              <span className={styles.chip}>{session.sceneState.atmosphere}</span>
              <span className={styles.chip}>节奏 {getPacingLabel(session.world.directorConfig.pacing)}</span>
            </div>
            <button
              type="button"
              className={styles.collapseButton}
              aria-expanded={!heroCollapsed}
              onClick={() => setHeroCollapsed((current) => !current)}
            >
              {heroCollapsed ? "展开场景" : "收起场景"}
            </button>
          </div>
        </div>

        <div className={styles.heroBody}>
          <p className={styles.heroSummary}>{session.sceneState.summary}</p>
          <div className={styles.stack}>
            <span className={styles.statusBadge}>{statusCopy}</span>
          </div>
        </div>
      </div>

      <div ref={chatStreamRef} className={styles.messageRail}>
        {session.messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div>
              <h3 className={styles.emptyTitle}>从第一句试探开始</h3>
              <p className={styles.emptyCopy}>
                聊天页现在只做一件事：帮助你读剧情、写下一句、继续推进场景。更复杂的记忆、关系和设定都被拆到独立页面里了。
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.messageList}>
            {session.messages.map((message) => {
              const paragraphs = splitParagraphs(message.content);
              if (message.role === "USER") {
                return (
                  <article key={message.id} className={styles.dialogueRow}>
                    <div className={styles.userBubble}>
                      <span className={styles.messageRole}>{session.playerProfile.displayName} 的动作</span>
                      {paragraphs.map((paragraph, index) => (
                        <p key={`${message.id}-${index}`} className={styles.messageCopy}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                );
              }

              return (
                <article key={message.id} className={styles.dialogueRow}>
                  <div className={styles.assistantBubble}>
                    <span className={styles.messageRole}>叙事系统</span>
                    {paragraphs.map((paragraph, index) => (
                      <p key={`${message.id}-${index}`} className={styles.messageCopy}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.suggestions}>
        {actionPrompts.map((prompt) => (
          <button
            key={prompt}
            className={styles.suggestionButton}
            type="button"
            onClick={() => setInput(prompt)}
            disabled={isWorking}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className={styles.composer}>
        <div className={styles.composerToolbar}>
          <div className={styles.lengthGroup}>
            {LENGTH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`${styles.lengthChip} ${minimumReplyLength === preset.value ? styles.lengthChipActive : ""}`}
                onClick={() => setMinimumReplyLength(normalizeMinimumReplyLength(preset.value))}
                disabled={isWorking}
              >
                回复 {preset.label}
              </button>
            ))}
          </div>
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} type="button" onClick={saveSession} disabled={isWorking || session.isSaved}>
              {session.isSaved ? "已保存" : "保存章节"}
            </button>
          </div>
        </div>

        <textarea
          className={styles.textarea}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="输入一句自然语言，让这一轮剧情继续向前。"
          rows={4}
          disabled={isWorking}
        />

        <div className={styles.composerFooter}>
          <span className={styles.mutedText}>
            {isWorking ? "正在生成剧情..." : "Enter 发送，Shift + Enter 换行。"}
          </span>
          <button className={styles.primaryButton} onClick={() => void sendMessage()} disabled={isWorking || !input.trim()}>
            {isWorking ? "生成中..." : "发送剧情"}
          </button>
        </div>
      </div>
    </section>
  );
}
