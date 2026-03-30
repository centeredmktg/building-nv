import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { resolvedBy, resolvedNote } = body;

  if (!resolvedBy) {
    return NextResponse.json(
      { error: "resolvedBy is required" },
      { status: 400 }
    );
  }

  const flag = await prisma.complianceFlag.findUnique({ where: { id } });
  if (!flag) {
    return NextResponse.json({ error: "Compliance flag not found" }, { status: 404 });
  }

  if (flag.resolvedAt) {
    return NextResponse.json(
      { error: "Flag is already resolved" },
      { status: 409 }
    );
  }

  const updated = await prisma.complianceFlag.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
      resolvedBy,
      resolvedNote: resolvedNote ?? null,
    },
  });

  return NextResponse.json(updated);
}
