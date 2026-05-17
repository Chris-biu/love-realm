import { redirect } from "next/navigation";
import { WorldGateway } from "@/components/world-gateway";
import { getWorldSelectionData } from "@/lib/session-service";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    session?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  if (params.session) {
    redirect(`/session/${params.session}`);
  }

  const data = await getWorldSelectionData();
  return <WorldGateway initialData={data} />;
}
