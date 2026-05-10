import { NextResponse } from "next/server";
import { createCharacterForWorld } from "@/lib/session-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      worldId?: string;
      sessionId?: string;
      name?: string;
      gender?: string;
      roleLabel?: string;
      publicSummary?: string;
      secretSummary?: string;
      personalityTags?: string[];
    };

    if (!body.worldId || !body.sessionId) {
      return NextResponse.json({ error: "缺少世界或会话信息。" }, { status: 400 });
    }

    const session = await createCharacterForWorld({
      worldId: body.worldId,
      sessionId: body.sessionId,
      name: body.name,
      gender: body.gender,
      roleLabel: body.roleLabel,
      publicSummary: body.publicSummary,
      secretSummary: body.secretSummary,
      personalityTags: body.personalityTags,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "新增角色失败。" },
      { status: 500 },
    );
  }
}
