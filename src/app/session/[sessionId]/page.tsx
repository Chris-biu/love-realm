import { notFound } from "next/navigation";
import { SessionChatWorkspace } from "@/components/session/session-chat-workspace";
import { getSessionDetail } from "@/lib/session-service";

export const dynamic = "force-dynamic";

type SessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId);
    return <SessionChatWorkspace initialSession={session} />;
  } catch {
    notFound();
  }
}
