import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, canvasData, thumbnailUrl } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (canvasData !== undefined) updateData.canvasData = canvasData;
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;

  try {
    const floorPlan = await prisma.floorPlan.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(floorPlan);
  } catch {
    return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });

  if (!floorPlan) {
    return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
  }

  return NextResponse.json(floorPlan);
}
