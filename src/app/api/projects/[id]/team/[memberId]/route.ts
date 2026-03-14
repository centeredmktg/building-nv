import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  await prisma.projectTeamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  const { role } = await req.json() as { role: string };
  if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

  const member = await prisma.projectTeamMember.update({
    where: { id: memberId },
    data: { role },
  });
  return NextResponse.json(member);
}
