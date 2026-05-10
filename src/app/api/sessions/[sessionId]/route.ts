import { NextResponse } from "next/server";
import { deleteSessionById, getSessionDetail, saveSessionById } from "@/lib/session-service";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await getSessionDetail(sessionId);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取会话失败。" },
      { status: 404 },
    );
  }
}

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const payload = await saveSessionById(sessionId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存进度失败。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const hydrateNextSession = searchParams.get("hydrateNextSession") !== "0";
    const payload = await deleteSessionById(sessionId, { hydrateNextSession });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除剧情分支失败。" },
      { status: 500 },
    );
  }
}