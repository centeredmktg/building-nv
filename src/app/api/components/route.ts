import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const components = await prisma.component.findMany({
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(components);
}

export async function POST(req: NextRequest) {
  const { name, description, category, vendorSku, vendorCost, unit, vendorId, sdsUrl, isHazardous } =
    await req.json();

  if (!name?.trim() || !vendorId || vendorCost == null) {
    return NextResponse.json(
      { error: "Name, vendorId, and vendorCost are required" },
      { status: 400 }
    );
  }

  const component = await prisma.component.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      category: category?.trim() || null,
      vendorSku: vendorSku?.trim() || null,
      vendorCost: parseFloat(vendorCost),
      unit: unit?.trim() || "ea",
      vendorId,
      sdsUrl: sdsUrl?.trim() || null,
      isHazardous: isHazardous === true,
    },
    include: { vendor: { select: { id: true, name: true } } },
  });

  return NextResponse.json(component, { status: 201 });
}
