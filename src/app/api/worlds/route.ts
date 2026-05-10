import { NextResponse } from "next/server";
import { createWorldCard, getWorldSelectionData } from "@/lib/session-service";

export async function GET() {
  try {
    const data = await getWorldSelectionData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载世界列表失败。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      premise?: string;
      defaultScene?: string;
    };

    const data = await createWorldCard(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建世界观失败。" },
      { status: 500 },
    );
  }
}