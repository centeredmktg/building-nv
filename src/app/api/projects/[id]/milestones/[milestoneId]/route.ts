import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, milestoneId } = await params;
  const body = await req.json();

  const allowedFields = ["name", "plannedDate", "completedAt", "position", "notes"];
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "plannedDate" || field === "completedAt") {
        data[field] = body[field] ? new Date(body[field]) : null;
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Scope to project to prevent cross-project mutation
  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data,
  });

  return NextResponse.json(milestone);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, milestoneId } = await params;

  // Scope to project to prevent cross-project deletion
  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  await prisma.milestone.delete({ where: { id: milestoneId } });
  return new NextResponse(null, { status: 204 });
}
