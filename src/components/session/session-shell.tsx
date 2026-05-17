"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { SessionBundle } from "@/lib/session-service";
import { getPacingLabel } from "./session-client-shared";
import { SessionNav } from "./session-nav";
import styles from "./session-shell.module.css";

type SessionShellProps = {
  session: SessionBundle;
  children: ReactNode;
};

export function SessionShell({ session, children }: SessionShellProps) {
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  return (
    <div className={styles.pageBackdrop}>
      <div className={styles.shell}>
        <header className={`${styles.header} ${styles.headerSticky} ${headerCollapsed ? styles.headerCollapsed : ""}`}>
          <div className={styles.headerDock}>
            <div className={styles.headerDockLead}>
              <Link href="/" className={styles.brandLink}>
                <span className={styles.brandMark} aria-hidden="true" />
                返回书架
              </Link>
              <div className={styles.headerDockCopy}>
                <p className={styles.eyebrow}>{session.world.name}</p>
                <p className={styles.headerDockTitle}>{session.title}</p>
              </div>
            </div>
            <div className={styles.headerDockActions}>
              <div className={styles.headerDockMeta}>
                <span className={styles.metaPill}>{session.sceneState.currentTime}</span>
                <span className={styles.metaPill}>{session.sceneState.atmosphere}</span>
                <span className={styles.metaPill}>节奏 {getPacingLabel(session.world.directorConfig.pacing)}</span>
              </div>
              <button
                type="button"
                className={styles.collapseButton}
                aria-expanded={!headerCollapsed}
                onClick={() => setHeaderCollapsed((current) => !current)}
              >
                {headerCollapsed ? "展开总览" : "收起总览"}
              </button>
            </div>
          </div>

          <div className={`${styles.headerBody} ${headerCollapsed ? styles.headerBodyCollapsed : ""}`}>
            <div className={styles.headerTop}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{session.world.name}</p>
                <h1 className={styles.title}>{session.title}</h1>
                <p className={styles.subtitle}>把聊天页留给阅读与输入，把关系、记忆和后台配置拆到独立页面。</p>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaPill}>{session.sceneState.currentTime}</span>
                <span className={styles.metaPill}>{session.sceneState.atmosphere}</span>
                <span className={styles.metaPill}>节奏 {getPacingLabel(session.world.directorConfig.pacing)}</span>
                <span className={styles.metaPill}>{session.isSaved ? "已存档" : "临时线"}</span>
              </div>
            </div>
          </div>

          <div className={styles.headerNavWrap}>
            <div className={styles.headerNavMeta}>
              <span className={styles.metaPill}>{session.sceneState.currentTime}</span>
              <span className={styles.metaPill}>{session.isSaved ? "已存档" : "临时线"}</span>
            </div>
            <SessionNav sessionId={session.id} />
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
