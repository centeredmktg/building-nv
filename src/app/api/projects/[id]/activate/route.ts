import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMilestoneTemplates } from "@/lib/milestoneTemplates";
import { POST_CONTRACT_STAGE_IDS } from "@/lib/crmTypes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const { contractAmount, targetCostAmount, estimatedStartDate, estimatedEndDate, timingNotes } = body;

  if (contractAmount == null || targetCostAmount == null) {
    return NextResponse.json(
      { error: "contractAmount and targetCostAmount are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      quotes: {
        where: { status: "accepted" },
        include: { sections: { include: { items: true } } },
        take: 1,
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (POST_CONTRACT_STAGE_IDS.includes(project.stage as never)) {
    return NextResponse.json(
      { error: "Project is already active." },
      { status: 409 }
    );
  }

  const milestoneData = getMilestoneTemplates(project.projectType);

  const updated = await prisma.project.update({
    where: { id },
    data: {
      stage: "preconstruction",
      contractAmount: Number(contractAmount),
      targetCostAmount: Number(targetCostAmount),
      estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : null,
      estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
      timingNotes: timingNotes ?? null,
      milestones: {
        createMany: {
          data: milestoneData.map((m) => ({
            name: m.name,
            position: m.position,
          })),
        },
      },
    },
    include: {
      milestones: { orderBy: { position: "asc" } },
      projectContacts: { include: { contact: true } },
    },
  });

  return NextResponse.json(updated);
}
