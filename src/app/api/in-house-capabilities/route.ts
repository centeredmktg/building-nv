import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const capabilities = await prisma.inHouseCapability.findMany({
    orderBy: { trade: "asc" },
  });

  return NextResponse.json(capabilities);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { capabilities } = body;

  if (!Array.isArray(capabilities)) {
    return NextResponse.json({ error: "capabilities array required" }, { status: 400 });
  }

  const results = await Promise.all(
    capabilities.map((cap: { trade: string; canPerform: boolean }) =>
      prisma.inHouseCapability.upsert({
        where: { trade: cap.trade },
        update: { canPerform: cap.canPerform },
        create: { trade: cap.trade, canPerform: cap.canPerform },
      }),
    ),
  );

  return NextResponse.json(results);
}
