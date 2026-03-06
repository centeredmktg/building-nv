import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { signerName } = await req.json();

  if (!signerName) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({ where: { slug } });
  if (!quote) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (quote.status === "accepted") {
    return NextResponse.json({ error: "Already accepted" }, { status: 409 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const acceptance = await prisma.acceptance.create({
    data: { quoteId: quote.id, signerName, ipAddress: ip },
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "accepted" },
  });

  return NextResponse.json(acceptance);
}
