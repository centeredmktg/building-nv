import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCustomer } from "@/lib/quickbooks/customers";
import { syncProject } from "@/lib/quickbooks/projects";
import { syncInvoice } from "@/lib/quickbooks/invoices";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { syncRecordId } = await req.json();
  if (!syncRecordId) {
    return NextResponse.json({ error: "syncRecordId required" }, { status: 400 });
  }

  const record = await prisma.qboSyncRecord.findUnique({
    where: { id: syncRecordId },
  });

  if (!record) {
    return NextResponse.json({ error: "Sync record not found" }, { status: 404 });
  }

  switch (record.entityType) {
    case "CUSTOMER":
      await syncCustomer(record.localId);
      break;
    case "PROJECT":
      await syncProject(record.localId);
      break;
    case "INVOICE":
      await syncInvoice(record.localId);
      break;
    default:
      return NextResponse.json({ error: "Cannot retry this entity type" }, { status: 422 });
  }

  const updated = await prisma.qboSyncRecord.findUnique({
    where: { id: syncRecordId },
  });

  return NextResponse.json({ syncRecord: updated });
}
