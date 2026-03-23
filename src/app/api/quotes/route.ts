import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuoteSlug } from "@/lib/slug";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await prisma.quote.findMany({
    include: { quoteContacts: { include: { contact: true } }, quoteCompanies: { include: { company: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    address?: string;
    projectType?: string;
    projectId?: string;
    contacts?: { contactId: string; role: string }[];
    companies?: { companyId: string; role: string }[];
    sections?: { title: string; items: { description: string; quantity: number; unit: string; unitPrice: number; isMaterial: boolean }[] }[];
  };

  if (!body.address?.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!body.projectType?.trim()) {
    return NextResponse.json({ error: "projectType is required" }, { status: 400 });
  }

  // Look up first contact's name for a human-readable slug
  let slugClientName = "";
  if (body.contacts?.[0]?.contactId) {
    const c = await prisma.contact.findUnique({
      where: { id: body.contacts[0].contactId },
      select: { firstName: true, lastName: true },
    });
    if (c) slugClientName = `${c.firstName} ${c.lastName ?? ""}`.trim();
  }
  const slug = generateQuoteSlug(slugClientName, body.address!);

  const quote = await prisma.quote.create({
    data: {
      slug,
      title: `${body.address} — ${body.projectType}`,
      address: body.address.trim(),
      projectType: body.projectType.trim(),
      clientId: null,
      projectId: body.projectId ?? null,
      quoteContacts: body.contacts?.length
        ? { create: body.contacts.map((c) => ({ contactId: c.contactId, role: c.role })) }
        : undefined,
      quoteCompanies: body.companies?.length
        ? { create: body.companies.map((c) => ({ companyId: c.companyId, role: c.role })) }
        : undefined,
    },
  });

  // Save sections if provided (happens when AI draft is accepted)
  if (body.sections?.length) {
    for (let si = 0; si < body.sections.length; si++) {
      const sec = body.sections[si];
      const section = await prisma.lineItemSection.create({
        data: { quoteId: quote.id, title: sec.title, position: si },
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

  // Re-fetch to include all relations
  const finalQuote = await prisma.quote.findUnique({
    where: { id: quote.id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });
  return NextResponse.json(finalQuote, { status: 201 });
}
