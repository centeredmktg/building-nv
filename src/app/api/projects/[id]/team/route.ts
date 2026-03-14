import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const members = await prisma.projectTeamMember.findMany({
    where: { projectId },
    include: {
      employee: {
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true } },
          certifications: { select: { type: true, verifiedStatus: true, expirationDate: true } },
        },
      },
    },
  });
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { employeeId, role } = await req.json() as { employeeId: string; role?: string };

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  // Verify employee exists and is active
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (employee.activeStatus === "terminated") {
    return NextResponse.json({ error: "Cannot assign terminated employee to project" }, { status: 400 });
  }

  const member = await prisma.projectTeamMember.create({
    data: { projectId, employeeId, role: role ?? "worker" },
    include: {
      employee: {
        include: { contact: { select: { firstName: true, lastName: true, phone: true } } },
      },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
