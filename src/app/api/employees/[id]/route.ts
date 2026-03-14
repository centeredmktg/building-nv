import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      contact: true,
      certifications: { orderBy: { createdAt: "desc" } },
      onboardingSteps: { orderBy: { stepName: "asc" } },
      projectTeam: {
        include: { project: { select: { id: true, name: true, stage: true } } },
      },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "legalName", "hireDate", "employmentType", "tradeClassification",
    "activeStatus", "terminatedAt",
    "homeAddress", "city", "state", "zip",
    "ec1Name", "ec1Relationship", "ec1Phone",
    "ec2Name", "ec2Relationship", "ec2Phone",
    "driversLicenseNumber", "driversLicenseExpiry",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "hireDate" || field === "terminatedAt" || field === "driversLicenseExpiry") {
        data[field] = body[field] ? new Date(body[field]) : null;
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const employee = await prisma.employee.update({ where: { id }, data });
  return NextResponse.json(employee);
}
