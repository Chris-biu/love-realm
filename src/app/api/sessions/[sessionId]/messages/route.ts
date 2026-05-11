import { NextResponse } from "next/server";
import { sendTurn } from "@/lib/session-service";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = (await request.json()) as {
      content?: string;
      model?: string;
      apiKey?: string;
      minimumReplyLength?: number;
    };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: "输入内容不能为空。" }, { status: 400 });
    }

    const payload = await sendTurn({
      sessionId,
      content: body.content.trim(),
      model: body.model,
      apiKey: body.apiKey,
      minimumReplyLength: body.minimumReplyLength,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发送消息失败。" },
      { status: 500 },
    );
  }
}
