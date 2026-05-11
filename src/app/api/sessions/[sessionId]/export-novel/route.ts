import { NextResponse } from "next/server";
import { buildNovelFileName, buildQuickNovelMarkdown, polishNovelMarkdown, type NovelExportMode } from "@/lib/novel-export";
import { getSessionDetail } from "@/lib/session-service";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      mode?: NovelExportMode;
      recentTurns?: number;
      apiKey?: string;
      model?: string;
    };
    const mode: NovelExportMode = body.mode === "polished" ? "polished" : "quick";
    const bundle = await getSessionDetail(sessionId);
    const draftMarkdown = buildQuickNovelMarkdown(bundle, { recentTurns: body.recentTurns });
    const markdown = mode === "polished"
      ? await polishNovelMarkdown({ bundle, draftMarkdown, apiKey: body.apiKey, model: body.model })
      : draftMarkdown;

    return NextResponse.json({
      fileName: buildNovelFileName(bundle),
      markdown,
      mode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出小说失败。" },
      { status: 500 },
    );
  }
}
