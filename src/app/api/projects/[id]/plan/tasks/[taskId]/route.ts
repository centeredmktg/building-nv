import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;
  const body = await req.json();
  const { status } = body;

  const validStatuses = ["pending", "in_progress", "completed", "blocked"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId: id },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      status: status ?? task.status,
      completedAt: status === "completed" ? new Date() : status !== "completed" ? null : undefined,
    },
    include: { complianceFlags: true },
  });

  return NextResponse.json(updated);
}
