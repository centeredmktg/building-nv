import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const milestones = await prisma.milestone.findMany({
    where: { projectId: id },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(milestones);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const maxPositionResult = await prisma.milestone.aggregate({
    where: { projectId: id },
    _max: { position: true },
  });
  const position = (maxPositionResult._max.position ?? -1) + 1;

  const milestone = await prisma.milestone.create({
    data: {
      projectId: id,
      name: body.name ?? "New Milestone",
      position,
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(milestone, { status: 201 });
}
