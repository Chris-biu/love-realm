import { NextResponse } from "next/server";
import { updateWorldSettings } from "@/lib/session-service";
import type { StatusMetricDefinition } from "@/lib/status-metrics";

type RouteContext = {
  params: Promise<{
    worldId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { worldId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      premise?: string;
      storyGuide?: string;
      statusMetrics?: StatusMetricDefinition[];
    };

    const world = await updateWorldSettings(worldId, {
      name: body.name,
      description: body.description,
      premise: body.premise,
      storyGuide: body.storyGuide,
      statusMetrics: body.statusMetrics,
    });

    return NextResponse.json({ world });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存世界设定失败。" },
      { status: 500 },
    );
  }
}
