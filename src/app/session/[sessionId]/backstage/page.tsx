import { notFound } from "next/navigation";
import { AVAILABLE_DEEPSEEK_MODELS } from "@/lib/config";
import { getSessionDetail, listSessions } from "@/lib/session-service";
import { SessionBackstageStudio } from "@/components/session/session-backstage-studio";

export const dynamic = "force-dynamic";

type SessionBackstagePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionBackstagePage({ params }: SessionBackstagePageProps) {
  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId);
    const sessions = await listSessions(session.world.id);

    return (
      <SessionBackstageStudio
        initialSession={session}
        sessions={sessions}
        availableModels={AVAILABLE_DEEPSEEK_MODELS}
      />
    );
  } catch {
    notFound();
  }
}
