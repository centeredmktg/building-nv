import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { components: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const { name, website, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const vendor = await prisma.vendor.create({
    data: { name: name.trim(), website: website?.trim() || null, notes: notes?.trim() || null },
  });
  return NextResponse.json(vendor, { status: 201 });
}
