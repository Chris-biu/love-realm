import { NextResponse } from "next/server";
import { deleteCharacterById, updateCharacterRuntimeState, updateCharacterSettings } from "@/lib/session-service";

type RouteContext = {
  params: Promise<{
    characterId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { characterId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      gender?: string;
      roleLabel?: string;
      publicSummary?: string;
      secretSummary?: string;
      personalityTags?: string[];
      sessionId?: string;
      runtimeState?: {
        currentIdentity?: string;
        currentRelationship?: string;
        attitudeTowardPlayer?: string;
        playerAddress?: string;
        persistentFacts?: string[];
      };
    };

    const character = await updateCharacterSettings(characterId, body);
    const session = body.sessionId && body.runtimeState
      ? await updateCharacterRuntimeState({ sessionId: body.sessionId, characterId, runtimeState: body.runtimeState })
      : null;
    return NextResponse.json({ character, session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存角色设定失败。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { characterId } = await context.params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "缺少当前会话信息。" }, { status: 400 });
    }

    const session = await deleteCharacterById(characterId, sessionId);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除角色失败。" },
      { status: 500 },
    );
  }
}
