import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { stage, notes } = body as { stage?: string; notes?: string };

  const update: { stage?: string; notes?: string } = {};
  if (stage !== undefined) update.stage = stage;
  if (notes !== undefined) update.notes = notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: update,
  });

  return NextResponse.json(project);
}
