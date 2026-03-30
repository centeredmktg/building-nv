import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTradeRecommendations } from "@/lib/recommendations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      sections: {
        include: { items: { select: { id: true, trade: true, description: true } } },
      },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const capabilities = await prisma.inHouseCapability.findMany();
  const recommendations = getTradeRecommendations(quote.sections, capabilities);

  return NextResponse.json(recommendations);
}
