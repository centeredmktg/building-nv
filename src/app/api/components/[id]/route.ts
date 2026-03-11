import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, description, category, vendorSku, vendorCost, unit } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (category !== undefined) data.category = category?.trim() || null;
  if (vendorSku !== undefined) data.vendorSku = vendorSku?.trim() || null;
  if (vendorCost !== undefined) data.vendorCost = parseFloat(vendorCost);
  if (unit !== undefined) data.unit = unit?.trim() || "ea";

  const component = await prisma.component.update({ where: { id }, data });
  return NextResponse.json(component);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.component.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
