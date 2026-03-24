import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await prisma.project.findMany({
    include: {
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}
