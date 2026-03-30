import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, estimatedStartDate: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const tasks = await prisma.projectTask.findMany({
    where: { projectId: id },
    include: {
      complianceFlags: true,
      dependsOn: { select: { id: true, position: true, name: true } },
      dependedOnBy: { select: { id: true, position: true, name: true } },
    },
    orderBy: { position: "asc" },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No plan generated for this project" }, { status: 404 });
  }

  const startDate = project.estimatedStartDate;
  const tasksWithDates = tasks.map((task) => ({
    ...task,
    absoluteStartDate: startDate
      ? new Date(startDate.getTime() + task.startDay * 86400000).toISOString().slice(0, 10)
      : null,
    absoluteEndDate: startDate
      ? new Date(startDate.getTime() + task.endDay * 86400000).toISOString().slice(0, 10)
      : null,
  }));

  const totalDurationDays = Math.max(...tasks.map((t) => t.endDay));
  const criticalPath = tasks.filter((t) => t.isCriticalPath).map((t) => t.name);

  return NextResponse.json({
    projectId: id,
    totalDurationDays,
    criticalPath,
    tasks: tasksWithDates,
  });
}
