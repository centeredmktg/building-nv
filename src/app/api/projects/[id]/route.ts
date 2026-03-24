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
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
      quotes: { select: { id: true, title: true, status: true, address: true } },
      teamMembers: {
        include: {
          employee: {
            include: {
              contact: { select: { firstName: true, lastName: true, phone: true } },
              certifications: true,
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "stage", "notes", "hazardNotes",
    "siteAddress", "siteCity", "siteState", "siteZip",
    "nearestER", "nearestERAddress", "assemblyPoint",
    "contractAmount", "targetCostAmount",
    "estimatedStartDate", "estimatedEndDate",
    "timingNotes", "estimatedCloseDate",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const dateFields = ["estimatedStartDate", "estimatedEndDate", "estimatedCloseDate"];
  for (const field of dateFields) {
    if (data[field] !== undefined && data[field] !== null) {
      data[field] = new Date(data[field] as string);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const project = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(project);
}
