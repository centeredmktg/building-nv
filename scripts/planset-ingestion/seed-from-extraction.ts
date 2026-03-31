import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PlansetExtraction } from "./types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) +
    "-" +
    Date.now().toString(36)
  );
}

async function seedFromExtraction(extraction: PlansetExtraction) {
  const { project: p, quote: q, trades, tasks, milestones } = extraction;

  // ── 1. Company (upsert by domain) ─────────────────────────────────────────
  const domain = `${p.ownerLastName.toLowerCase()}-${p.shortCode.toLowerCase()}.client`;
  const company = await prisma.company.upsert({
    where: { domain },
    update: { name: `${p.ownerFirstName} ${p.ownerLastName}`, type: "customer" },
    create: {
      name: `${p.ownerFirstName} ${p.ownerLastName}`,
      type: "customer",
      domain,
      phone: p.ownerPhone ?? null,
    },
  });

  // ── 2. Contact (upsert by email, or placeholder) ──────────────────────────
  const email = p.ownerEmail ?? `${p.shortCode.toLowerCase()}@placeholder.client`;
  const contact = await prisma.contact.upsert({
    where: { email },
    update: {
      firstName: p.ownerFirstName,
      lastName: p.ownerLastName,
      phone: p.ownerPhone ?? null,
      primaryCompanyId: company.id,
    },
    create: {
      firstName: p.ownerFirstName,
      lastName: p.ownerLastName,
      email,
      phone: p.ownerPhone ?? null,
      type: "customer",
      primaryCompanyId: company.id,
    },
  });

  // ── 3. Project ─────────────────────────────────────────────────────────────
  const notesLines = [
    `Architect: ${p.architect}`,
    `Engineer: ${p.engineer}`,
    p.interiorDesigner ? `Interior Designer: ${p.interiorDesigner}` : null,
    `Existing SF: ${p.existingSqft} | Added SF: ${p.addedSqft}`,
    `Construction Type: ${p.constructionType}`,
    `Bedrooms: ${p.bedrooms} | Bathrooms: ${p.bathrooms}`,
    p.specialRequirements.length
      ? `Special Requirements: ${p.specialRequirements.join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const project = await prisma.project.create({
    data: {
      name: p.name,
      shortCode: p.shortCode,
      stage: "preconstruction",
      projectType: p.projectType,
      siteAddress: p.address,
      siteCity: p.city,
      siteState: p.state,
      siteZip: p.zip,
      hazardNotes: p.hazardNotes ?? null,
      nearestER: p.nearestER ?? null,
      nearestERAddress: p.nearestERAddress ?? null,
      notes: notesLines,
    },
  });

  // ── 4. ProjectContact + ProjectCompany ────────────────────────────────────
  await prisma.projectContact.create({
    data: { projectId: project.id, contactId: contact.id, role: "customer" },
  });
  await prisma.projectCompany.create({
    data: { projectId: project.id, companyId: company.id, role: "customer" },
  });

  // ── 5. Quote ──────────────────────────────────────────────────────────────
  const slug = generateSlug(q.title);
  const quote = await prisma.quote.create({
    data: {
      slug,
      title: q.title,
      address: `${p.address}, ${p.city}, ${p.state} ${p.zip}`,
      projectType: p.projectType,
      status: "draft",
      scopeText: q.scopeText,
      materialMarkupPct: q.materialMarkupPct,
      overheadPct: q.overheadPct,
      profitPct: q.profitPct,
      estimatedDuration: q.estimatedDuration,
      projectId: project.id,
    },
  });

  // ── 6. QuoteContact + QuoteCompany ────────────────────────────────────────
  await prisma.quoteContact.create({
    data: { quoteId: quote.id, contactId: contact.id, role: "decision_maker" },
  });
  await prisma.quoteCompany.create({
    data: { quoteId: quote.id, companyId: company.id, role: "owner" },
  });

  // ── 7. LineItemSections + LineItems ───────────────────────────────────────
  let totalLineItems = 0;
  let baseValue = 0;

  for (let si = 0; si < trades.length; si++) {
    const tradeSection = trades[si];
    const section = await prisma.lineItemSection.create({
      data: {
        title: tradeSection.sectionTitle,
        position: si,
        trade: tradeSection.trade,
        quoteId: quote.id,
      },
    });

    for (let li = 0; li < tradeSection.lineItems.length; li++) {
      const item = tradeSection.lineItems[li];
      await prisma.lineItem.create({
        data: {
          description: item.description,
          quantity: item.quantity,
          unit: item.unit.toLowerCase(),
          unitPrice: item.unitPrice,
          vendorCost: item.vendorCost ?? null,
          isMaterial: item.isMaterial,
          position: li,
          sectionId: section.id,
          trade: tradeSection.trade,
        },
      });
      baseValue += item.quantity * item.unitPrice;
      totalLineItems++;
    }
  }

  // ── 8. Milestones ─────────────────────────────────────────────────────────
  for (const ms of milestones) {
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: ms.name,
        position: ms.position,
        billingAmount: parseFloat((baseValue * (ms.billingPercentage / 100)).toFixed(2)),
        plannedDate: null,
      },
    });
  }

  // ── 9. ProjectTasks with dependency scheduling ────────────────────────────
  // First pass: create all tasks without dependencies, compute startDay/endDay
  const taskNameMap = new Map<string, { id: string; endDay: number }>();

  // Build adjacency: name → dependsOn names
  // We need a topological ordering so we can compute startDay correctly.
  // Simple approach: iterate until all tasks are placed (handles DAGs with < 1000 tasks)
  const remaining = [...tasks];
  const placed = new Map<string, { id: string; startDay: number; endDay: number }>();
  const phasePositions = new Map<string, number>();

  let maxPasses = tasks.length + 1;
  while (remaining.length > 0 && maxPasses-- > 0) {
    const nextRound: typeof remaining = [];

    for (const task of remaining) {
      const allDepsPlaced = task.dependsOn.every((dep) => placed.has(dep));
      if (!allDepsPlaced) {
        nextRound.push(task);
        continue;
      }

      const startDay =
        task.dependsOn.length === 0
          ? 0
          : Math.max(...task.dependsOn.map((dep) => placed.get(dep)!.endDay));
      const endDay = startDay + task.durationDays;

      const phasePos = phasePositions.get(task.phase) ?? 0;
      phasePositions.set(task.phase, phasePos + 1);

      const created = await prisma.projectTask.create({
        data: {
          projectId: project.id,
          name: task.name,
          phase: task.phase,
          position: phasePos,
          durationDays: task.durationDays,
          startDay,
          endDay,
          isMilestoneTask: task.isMilestoneTask,
          isCriticalPath: task.isCriticalPath,
          status: "pending",
        },
      });

      placed.set(task.name, { id: created.id, startDay, endDay });
      taskNameMap.set(task.name, { id: created.id, endDay });
    }

    remaining.length = 0;
    remaining.push(...nextRound);
  }

  // Any tasks that couldn't be placed (circular deps or missing dep names)
  for (const task of remaining) {
    const phasePos = phasePositions.get(task.phase) ?? 0;
    phasePositions.set(task.phase, phasePos + 1);
    const created = await prisma.projectTask.create({
      data: {
        projectId: project.id,
        name: task.name,
        phase: task.phase,
        position: phasePos,
        durationDays: task.durationDays,
        startDay: 0,
        endDay: task.durationDays,
        isMilestoneTask: task.isMilestoneTask,
        isCriticalPath: task.isCriticalPath,
        status: "pending",
      },
    });
    placed.set(task.name, { id: created.id, startDay: 0, endDay: task.durationDays });
    taskNameMap.set(task.name, { id: created.id, endDay: task.durationDays });
  }

  // Second pass: wire up dependsOn relations
  for (const task of tasks) {
    if (task.dependsOn.length === 0) continue;
    const taskRecord = placed.get(task.name);
    if (!taskRecord) continue;

    const depIds = task.dependsOn
      .map((dep) => placed.get(dep)?.id)
      .filter((id): id is string => !!id);

    if (depIds.length > 0) {
      await prisma.projectTask.update({
        where: { id: taskRecord.id },
        data: {
          dependsOn: { connect: depIds.map((id) => ({ id })) },
        },
      });
    }
  }

  // ── 10. Summary ───────────────────────────────────────────────────────────
  console.log("\n=== Seed Complete ===");
  console.log(`Project ID:    ${project.id}`);
  console.log(`Project Name:  ${project.name}`);
  console.log(`Quote ID:      ${quote.id}`);
  console.log(`Slug:          ${slug}`);
  console.log(`Proposal URL:  /proposals/${slug}`);
  console.log(`Edit URL:      /internal/quotes/${quote.id}/edit`);
  console.log(`Base Value:    $${baseValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Sections:      ${trades.length}`);
  console.log(`Line Items:    ${totalLineItems}`);
  console.log(`Milestones:    ${milestones.length}`);
  console.log(`Tasks:         ${placed.size}`);
  console.log("====================\n");
}

async function main() {
  const moduleName = process.argv[2] ?? "zkho";
  console.log(`Loading extraction data: ${moduleName}`);

  // Dynamic import — each extraction file exports a named const matching `${name}Extraction`
  const mod = await import(`./extraction-data/${moduleName}`);
  const exportKey = Object.keys(mod).find((k) => k.endsWith("Extraction"));
  if (!exportKey) {
    throw new Error(`No *Extraction export found in extraction-data/${moduleName}.ts`);
  }
  const extraction: PlansetExtraction = mod[exportKey];

  await seedFromExtraction(extraction);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
