import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
      milestones: { orderBy: { position: "asc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      materialMarkupPct: body.materialMarkupPct,
      overheadPct: body.overheadPct,
      profitPct: body.profitPct,
      paymentTerms: body.paymentTerms,
      exclusions: body.exclusions,
      notes: body.notes,
      status: body.status,
      sentAt: body.status === "sent" ? new Date() : undefined,
      estimatedStartDate: body.estimatedStartDate ? new Date(body.estimatedStartDate) : undefined,
      estimatedDuration: body.estimatedDuration ?? undefined,
    },
  });

  if (body.sections) {
    await prisma.lineItemSection.deleteMany({ where: { quoteId: id } });

    for (let si = 0; si < body.sections.length; si++) {
      const sec = body.sections[si];
      const section = await prisma.lineItemSection.create({
        data: { quoteId: id, title: sec.title, position: si },
      });
      for (let li = 0; li < sec.items.length; li++) {
        const item = sec.items[li];
        await prisma.lineItem.create({
          data: {
            sectionId: section.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            isMaterial: item.isMaterial ?? false,
            position: li,
          },
        });
      }
    }
  }

  if (body.milestones) {
    await prisma.quoteMilestone.deleteMany({ where: { quoteId: id } });
    for (let i = 0; i < body.milestones.length; i++) {
      const m = body.milestones[i];
      await prisma.quoteMilestone.create({
        data: {
          quoteId: id,
          name: m.name,
          weekNumber: m.weekNumber,
          duration: m.duration ?? null,
          paymentPct: m.paymentPct ?? null,
          paymentLabel: m.paymentLabel ?? null,
          position: i,
        },
      });
    }
  }

  const updated = await prisma.quote.findUnique({
    where: { id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      milestones: { orderBy: { position: "asc" } },
    },
  });
  return NextResponse.json(updated);
}
