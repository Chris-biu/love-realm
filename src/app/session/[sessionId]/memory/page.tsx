import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/session-service";
import { summarizePlayerProfile } from "@/components/session/session-client-shared";
import styles from "@/components/session/session-shell.module.css";

export const dynamic = "force-dynamic";

type SessionMemoryPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionMemoryPage({ params }: SessionMemoryPageProps) {
  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId);

    return (
      <div className={styles.stack}>
        <section className={`${styles.panel} ${styles.hero}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>回忆与场景</p>
            <h2 className={styles.heroTitle}>{session.sceneState.currentScene}</h2>
            <p className={styles.heroSummary}>
              这个页面专门负责查看场景状态、长期记忆、世界前提和当前线索，不打断聊天主界面。
            </p>
          </div>
          <div className={styles.stack}>
            <span className={styles.chip}>{session.sceneState.currentTime}</span>
            <span className={styles.chip}>{session.sceneState.atmosphere}</span>
            <span className={styles.chip}>{session.memorySummaries.length} 条长期记忆</span>
          </div>
        </section>

        <div className={styles.splitGrid}>
          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>长期记忆</p>
                <h3 className={styles.sectionTitle}>继续写之前先回看已经被记住的内容</h3>
              </div>
            </div>
            {session.memorySummaries.length ? (
              <div className={styles.memoryList}>
                {session.memorySummaries.map((item) => (
                  <article key={item.id} className={styles.memoryItem}>
                    <h4 className={styles.memoryHeading}>第 {item.turnNumber} 轮</h4>
                    <p className={styles.mutedText}>{item.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>当前还没有长期记忆摘要。</p>
            )}
          </section>

          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>背景与线索</p>
                <h3 className={styles.sectionTitle}>把世界前提、当前变化和事实拆出来看</h3>
              </div>
            </div>
            <div className={styles.infoGrid}>
              <article className={styles.statCard}>
                <p className={styles.eyebrow}>世界前提</p>
                <span className={styles.statValue}>{session.world.name}</span>
                <p className={styles.statLabel}>{session.world.premise}</p>
              </article>
              <article className={styles.statCard}>
                <p className={styles.eyebrow}>主角快照</p>
                <span className={styles.statValue}>{session.playerProfile.displayName}</span>
                <p className={styles.statLabel}>{summarizePlayerProfile(session.playerProfile) || "尚未完善主角设定。"}</p>
              </article>
            </div>

            <article className={styles.memoryItem}>
              <h4 className={styles.memoryHeading}>场景变化</h4>
              {session.sceneState.changes.length ? (
                <div className={styles.factsList}>
                  {session.sceneState.changes.map((item, index) => (
                    <p key={`${item}-${index}`} className={styles.mutedText}>{item}</p>
                  ))}
                </div>
              ) : (
                <p className={styles.mutedText}>这一轮还没有额外记录的场景变化。</p>
              )}
            </article>

            <article className={styles.memoryItem}>
              <h4 className={styles.memoryHeading}>场景事实</h4>
              {session.sceneState.facts.length ? (
                <div className={styles.factsList}>
                  {session.sceneState.facts.map((item, index) => (
                    <p key={`${item}-${index}`} className={styles.mutedText}>{item}</p>
                  ))}
                </div>
              ) : (
                <p className={styles.mutedText}>当前没有记录的新事实。</p>
              )}
            </article>
          </section>
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
