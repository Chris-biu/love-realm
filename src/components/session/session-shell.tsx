"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { SessionBundle } from "@/lib/session-service";
import { getPacingLabel } from "./session-client-shared";
import { SessionNav } from "./session-nav";
import styles from "./session-shell.module.css";

type SessionShellProps = {
  session: SessionBundle;
  children: ReactNode;
};

export function SessionShell({ session, children }: SessionShellProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overviewSummary = useMemo(
    () => [session.sceneState.currentTime, session.sceneState.atmosphere, `节奏 ${getPacingLabel(session.world.directorConfig.pacing)}`].join(" · "),
    [session.sceneState.atmosphere, session.sceneState.currentTime, session.world.directorConfig.pacing],
  );

  return (
    <div className={styles.pageBackdrop}>
      <div className={styles.shell}>
        <div className={styles.chatTopbar}>
          <Link href="/" className={styles.brandLink}>
            <span className={styles.brandMark} aria-hidden="true" />
            返回书架
          </Link>
          <button
            type="button"
            className={styles.overviewLauncher}
            aria-expanded={overviewOpen}
            onClick={() => setOverviewOpen(true)}
          >
            总览
          </button>
        </div>

        {overviewOpen ? (
          <div className={styles.overviewOverlay} role="dialog" aria-modal="true" aria-label="会话总览">
            <div className={styles.overviewPanel}>
              <div className={styles.overviewHeader}>
                <div className={styles.headerCopy}>
                  <p className={styles.eyebrow}>{session.world.name}</p>
                  <h1 className={styles.title}>{session.title}</h1>
                  <p className={styles.subtitle}>{overviewSummary}</p>
                </div>
                <button type="button" className={styles.collapseButton} onClick={() => setOverviewOpen(false)}>
                  关闭总览
                </button>
              </div>

              <div className={styles.overviewMetaGrid}>
                <article className={styles.overviewCard}>
                  <p className={styles.eyebrow}>当前时间</p>
                  <strong className={styles.sectionTitle}>{session.sceneState.currentTime}</strong>
                </article>
                <article className={styles.overviewCard}>
                  <p className={styles.eyebrow}>当前氛围</p>
                  <strong className={styles.sectionTitle}>{session.sceneState.atmosphere}</strong>
                </article>
                <article className={styles.overviewCard}>
                  <p className={styles.eyebrow}>推进节奏</p>
                  <strong className={styles.sectionTitle}>{getPacingLabel(session.world.directorConfig.pacing)}</strong>
                </article>
                <article className={styles.overviewCard}>
                  <p className={styles.eyebrow}>存档状态</p>
                  <strong className={styles.sectionTitle}>{session.isSaved ? "已存档" : "临时线"}</strong>
                </article>
              </div>

              <div className={styles.overviewBody}>
                <section className={styles.overviewCard}>
                  <p className={styles.eyebrow}>导航</p>
                  <SessionNav sessionId={session.id} />
                </section>
                <section className={styles.overviewCard}>
                  <p className={styles.eyebrow}>世界前提</p>
                  <p className={styles.mutedText}>{session.world.premise}</p>
                </section>
                <section className={styles.overviewCard}>
                  <p className={styles.eyebrow}>当前场景信息</p>
                  <p className={styles.mutedText}>{session.sceneState.currentScene}</p>
                  <p className={styles.mutedText}>{session.sceneState.summary}</p>
                </section>
              </div>
            </div>
          </div>
        ) : null}

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
