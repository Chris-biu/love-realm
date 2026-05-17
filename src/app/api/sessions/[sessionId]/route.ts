import { NextResponse } from "next/server";
import { deleteSessionById, getSessionDetail, listSessions, saveSessionById, updatePlayerProfile, updateSessionModel } from "@/lib/session-service";
import type { PlayerProfile } from "@/lib/story-director";

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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      playerProfile?: PlayerProfile;
      model?: string;
    };

    if (body.playerProfile) {
      const session = await updatePlayerProfile(sessionId, body.playerProfile);
      return NextResponse.json({ session, sessions: await listSessions(session.world.id) });
    }

    if (body.model) {
      const session = await updateSessionModel(sessionId, body.model);
      return NextResponse.json({ session, sessions: await listSessions(session.world.id) });
    }

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
