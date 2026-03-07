import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}
