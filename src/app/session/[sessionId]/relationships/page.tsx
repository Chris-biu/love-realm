import { notFound } from "next/navigation";
import { getMetricMax, getRelationshipStage } from "@/lib/relationship-scale";
import { getSessionDetail } from "@/lib/session-service";
import { formatRuntimeState, summarizePlayerProfile } from "@/components/session/session-client-shared";
import styles from "@/components/session/session-shell.module.css";

export const dynamic = "force-dynamic";

type SessionRelationshipsPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionRelationshipsPage({ params }: SessionRelationshipsPageProps) {
  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId);

    return (
      <div className={styles.stack}>
        <section className={`${styles.panel} ${styles.hero}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>关系与状态</p>
            <h2 className={styles.heroTitle}>{session.playerProfile.displayName}</h2>
            <p className={styles.heroSummary}>
              {summarizePlayerProfile(session.playerProfile) || "这一页专门负责看角色关系、状态上限和动态档案，不让聊天页被信息板淹没。"}
            </p>
          </div>
          <div className={styles.stack}>
            <span className={styles.chip}>{session.relationships.length} 位角色</span>
            <span className={styles.chip}>{session.statusMetrics.length} 项状态栏</span>
            <span className={styles.chip}>{session.world.name}</span>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>角色关系图</p>
              <h3 className={styles.sectionTitle}>单独查看每个角色的温度、阶段和动态档案</h3>
            </div>
          </div>

          <div className={styles.characterGrid}>
            {session.relationships.map((relationship) => {
              const character = session.characters.find((item) => item.id === relationship.characterId);
              const runtimeLines = character ? formatRuntimeState(character.runtimeState) : [];

              return (
                <article key={relationship.id} className={styles.characterCard}>
                  <div className={styles.characterHead}>
                    <div>
                      <h4 className={styles.characterName}>{relationship.character.name}</h4>
                      <p className={styles.characterMeta}>
                        {relationship.character.gender}
                        {character ? ` / ${character.roleLabel}` : ""}
                      </p>
                    </div>
                    <span className={styles.pillNote}>{runtimeLines.length ? "动态档案已激活" : "主要看关系数值"}</span>
                  </div>

                  <div className={styles.metricsGrid}>
                    {session.statusMetrics.map((metric) => {
                      const max = getMetricMax(metric);
                      const value = relationship.metrics[metric.key] ?? 0;
                      return (
                        <div key={metric.key} className={styles.metricCard}>
                          <div className={styles.metricTopline}>
                            <span>{metric.label}</span>
                            <strong>{value}/{max}</strong>
                          </div>
                          <div className={styles.metricTrack}>
                            <span className={styles.metricFill} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
                          </div>
                          <p className={styles.characterMeta}>{getRelationshipStage(value, metric.key, max)}</p>
                        </div>
                      );
                    })}
                  </div>

                  {runtimeLines.length ? (
                    <div className={styles.runtimeList}>
                      {runtimeLines.map((line, index) => (
                        <p key={`${relationship.id}-${index}`} className={styles.mutedText}>{line}</p>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  } catch {
    notFound();
  }
}
