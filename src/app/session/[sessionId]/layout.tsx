import { notFound } from "next/navigation";
import { SessionShell } from "@/components/session/session-shell";
import { getSessionDetail } from "@/lib/session-service";

export const dynamic = "force-dynamic";

type SessionLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionLayout({ children, params }: SessionLayoutProps) {
  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId);
    return <SessionShell session={session}>{children}</SessionShell>;
  } catch {
    notFound();
  }
}
