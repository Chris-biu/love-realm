import { NextResponse } from "next/server";
import { createNewSession, listSessions } from "@/lib/session-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get("worldId") || undefined;
    const sessions = await listSessions(worldId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载会话列表失败。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      model?: string;
      worldId?: string;
      isSaved?: boolean;
    };
    const payload = await createNewSession({
      model: body.model,
      worldId: body.worldId,
      isSaved: body.isSaved,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建会话失败。" },
      { status: 500 },
    );
  }
}