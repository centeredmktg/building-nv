import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMilestoneTemplates } from "@/lib/milestoneTemplates";
import { POST_CONTRACT_STAGE_IDS } from "@/lib/crmTypes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generatePlan } from "@/lib/compliance/plan-generator";
import { getAllRules } from "@/lib/compliance/corpus-loader";
import type { ProjectContext } from "@/lib/compliance/types";
import type { ProjectTask } from "@/generated/prisma/client";

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
        include: {
          sections: { include: { items: true } },
          quoteCompanies: { include: { company: true } },
        },
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

  // Generate project plan from quote scope + compliance rules
  const quote = project.quotes[0];
  let plan = null;

  if (quote?.sections?.length) {
    const ctx: ProjectContext = {
      projectType: project.projectType ?? "general",
      scopeSections: quote.sections.map((s) => ({
        title: s.title,
        items: s.items.map((i) => ({ description: i.description })),
      })),
      contractAmount: Number(contractAmount),
      companyRoles: quote.quoteCompanies?.map((qc) => ({
        type: qc.company.type,
        role: qc.role,
      })),
      siteAddress: project.siteAddress ?? undefined,
    };

    const rules = getAllRules();
    const generated = generatePlan(rules, ctx);
    plan = generated;

    // Persist tasks and compliance flags in a transaction
    await prisma.$transaction(async (tx) => {
      const createdTasks: ProjectTask[] = [];
      for (const task of generated.tasks) {
        const created = await tx.projectTask.create({
          data: {
            projectId: id,
            name: task.name,
            phase: task.phase,
            position: task.position,
            durationDays: task.durationDays,
            startDay: task.startDay,
            endDay: task.endDay,
            isMilestoneTask: task.isMilestoneTask,
            isCriticalPath: task.isCriticalPath,
            status: "pending",
          },
        });
        createdTasks.push(created);

        for (const flag of task.complianceFlags) {
          await tx.complianceFlag.create({
            data: {
              projectTaskId: created.id,
              ruleId: flag.ruleId,
              severity: flag.severity,
              title: flag.title,
              citation: flag.citation,
              actionItem: flag.actionItem,
            },
          });
        }
      }

      // Wire up dependencies
      for (const task of generated.tasks) {
        if (task.dependsOnPositions.length > 0) {
          const taskRecord = createdTasks[task.position];
          const depRecords = task.dependsOnPositions
            .map((pos) => createdTasks[pos])
            .filter(Boolean);

          if (taskRecord && depRecords.length > 0) {
            await tx.projectTask.update({
              where: { id: taskRecord.id },
              data: {
                dependsOn: {
                  connect: depRecords.map((d) => ({ id: d.id })),
                },
              },
            });
          }
        }
      }
    });
  }

  return NextResponse.json({ ...updated, plan });
}
