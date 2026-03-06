import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuoteSlug } from "@/lib/slug";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await prisma.quote.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientName, clientCompany, address, projectType, scopeText } = body;

  // Upsert client by name+company
  const client = await prisma.client.upsert({
    where: { id: body.clientId || "" },
    create: { name: clientName, company: clientCompany },
    update: { name: clientName, company: clientCompany },
  });

  const slug = generateQuoteSlug(clientName, address);

  const quote = await prisma.quote.create({
    data: {
      slug,
      title: `${address} — ${projectType}`,
      address,
      projectType,
      scopeText,
      clientId: client.id,
    },
    include: { client: true, sections: { include: { items: true } } },
  });

  return NextResponse.json(quote);
}
