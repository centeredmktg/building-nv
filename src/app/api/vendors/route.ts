import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { components: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, website, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const vendor = await prisma.vendor.create({
    data: { name: name.trim(), website: website?.trim() || null, notes: notes?.trim() || null },
  });
  return NextResponse.json(vendor, { status: 201 });
}
