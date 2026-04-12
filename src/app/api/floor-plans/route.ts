import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, projectId, sourceImageUrl, canvasData } = body;

  if (!name || !canvasData) {
    return NextResponse.json({ error: "name and canvasData are required" }, { status: 400 });
  }

  const floorPlan = await prisma.floorPlan.create({
    data: {
      name,
      projectId: projectId || null,
      sourceImageUrl: sourceImageUrl || null,
      canvasData,
    },
  });

  return NextResponse.json(floorPlan);
}
