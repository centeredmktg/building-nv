import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeComplete = searchParams.get("includeComplete") === "true";

  const stages = ["preconstruction", "active", "punch_list"];
  if (includeComplete) stages.push("complete");

  const projects = await prisma.project.findMany({
    where: { stage: { in: stages } },
    include: {
      milestones: { orderBy: { position: "asc" } },
      projectContacts: { include: { contact: true } },
    },
  });

  // Sort: estimatedEndDate asc, null dates last
  projects.sort((a, b) => {
    if (!a.estimatedEndDate && !b.estimatedEndDate) return 0;
    if (!a.estimatedEndDate) return 1;
    if (!b.estimatedEndDate) return -1;
    return new Date(a.estimatedEndDate).getTime() - new Date(b.estimatedEndDate).getTime();
  });

  return NextResponse.json(projects);
}
