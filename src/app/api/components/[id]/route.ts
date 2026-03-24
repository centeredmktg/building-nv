import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const component = await prisma.component.findUnique({
    where: { id },
    include: { vendor: { select: { id: true, name: true } } },
  });
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(component);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { name, description, category, vendorSku, vendorCost, unit, vendorId, sdsUrl, isHazardous } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (category !== undefined) data.category = category?.trim() || null;
  if (vendorSku !== undefined) data.vendorSku = vendorSku?.trim() || null;
  if (vendorCost !== undefined) data.vendorCost = parseFloat(vendorCost);
  if (unit !== undefined) data.unit = unit?.trim() || "ea";
  if (vendorId !== undefined) data.vendorId = vendorId;
  if (sdsUrl !== undefined) data.sdsUrl = sdsUrl?.trim() || null;
  if (isHazardous !== undefined) data.isHazardous = isHazardous === true;

  const component = await prisma.component.update({
    where: { id },
    data,
    include: { vendor: { select: { id: true, name: true } } },
  });
  return NextResponse.json(component);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.component.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
