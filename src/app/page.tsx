import { ChatApp } from "@/components/chat-app";
import { WorldSelect } from "@/components/world-select";
import { getAppBootstrap, getWorldSelectionData } from "@/lib/session-service";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    session?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  if (!params.session) {
    const data = await getWorldSelectionData();
    return <WorldSelect initialData={data} />;
  }

  const data = await getAppBootstrap(params.session);
  return <ChatApp initialData={data} initialSessionId={data.activeSession.id} />;
}