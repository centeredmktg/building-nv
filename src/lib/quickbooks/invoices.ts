import { prisma } from "@/lib/prisma";
import { qboRequest } from "./client";
import { syncProject } from "./projects";
import type { QboInvoice, QboInvoiceLine } from "./types";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface InvoiceForSync {
  invoiceNumber: string;
  amount?: number;
  issueDate: Date;
  dueDate: Date;
  invoiceMilestones: Array<{
    milestone: { name: string; billingAmount: number | null };
  }>;
}

export function buildQboInvoicePayload(
  invoice: InvoiceForSync,
  qboCustomerId: string,
  qboProjectId: string,
  qboId?: string,
  syncToken?: string
): QboInvoice {
  const lines: QboInvoiceLine[] = [];

  if (invoice.invoiceMilestones.length > 0) {
    for (const im of invoice.invoiceMilestones) {
      const amount = im.milestone.billingAmount ?? 0;
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: amount,
        Description: im.milestone.name,
        SalesItemLineDetail: { UnitPrice: amount, Qty: 1 },
      });
    }
  } else {
    const amount = invoice.amount ?? 0;
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: amount,
      Description: `Invoice ${invoice.invoiceNumber}`,
      SalesItemLineDetail: { UnitPrice: amount, Qty: 1 },
    });
  }

  const payload: QboInvoice = {
    DocNumber: invoice.invoiceNumber,
    TxnDate: formatDate(invoice.issueDate),
    DueDate: formatDate(invoice.dueDate),
    CustomerRef: { value: qboCustomerId },
    ProjectRef: { value: qboProjectId },
    Line: lines,
  };

  if (qboId) payload.Id = qboId;
  if (syncToken) payload.SyncToken = syncToken;

  return payload;
}

/**
 * Resolve QBO Project ID for an invoice's project. Syncs project if needed.
 */
async function ensureProjectSynced(projectId: string): Promise<{ qboCustomerId: string; qboProjectId: string }> {
  const projectSync = await prisma.qboSyncRecord.findUnique({
    where: {
      entityType_localId: {
        entityType: "PROJECT",
        localId: projectId,
      },
    },
  });

  if (!projectSync || projectSync.lastSyncStatus !== "SUCCESS" || !projectSync.qboId) {
    await syncProject(projectId);

    const newSync = await prisma.qboSyncRecord.findUnique({
      where: {
        entityType_localId: {
          entityType: "PROJECT",
          localId: projectId,
        },
      },
    });

    if (!newSync || newSync.lastSyncStatus !== "SUCCESS" || !newSync.qboId) {
      throw new Error(`Failed to sync project ${projectId} to QBO`);
    }
  }

  const projectCompany = await prisma.projectCompany.findFirst({
    where: { projectId, role: "customer" },
  });

  if (!projectCompany) {
    throw new Error(`No customer company linked to project ${projectId}`);
  }

  const customerSync = await prisma.qboSyncRecord.findUnique({
    where: {
      entityType_localId: {
        entityType: "CUSTOMER",
        localId: projectCompany.companyId,
      },
    },
  });

  if (!customerSync || !customerSync.qboId) {
    throw new Error(`Customer company ${projectCompany.companyId} not synced to QBO`);
  }

  const projectSyncFinal = await prisma.qboSyncRecord.findUnique({
    where: {
      entityType_localId: {
        entityType: "PROJECT",
        localId: projectId,
      },
    },
  });

  return {
    qboCustomerId: customerSync.qboId,
    qboProjectId: projectSyncFinal!.qboId,
  };
}

/**
 * Sync an Invoice to QBO. Ensures parent Project and Customer exist first.
 * Non-blocking — records failure but does not throw.
 */
export async function syncInvoice(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        invoiceMilestones: {
          include: { milestone: true },
        },
      },
    });

    const { qboCustomerId, qboProjectId } = await ensureProjectSynced(invoice.projectId);

    const existingSync = await prisma.qboSyncRecord.findUnique({
      where: {
        entityType_localId: {
          entityType: "INVOICE",
          localId: invoiceId,
        },
      },
    });

    if (existingSync) {
      const payload = buildQboInvoicePayload(
        invoice,
        qboCustomerId,
        qboProjectId,
        existingSync.qboId,
        existingSync.qboSyncToken ?? undefined
      );
      const result = await qboRequest<{ Invoice: QboInvoice }>(
        "POST",
        "invoice",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.update({
        where: { id: existingSync.id },
        data: {
          qboSyncToken: result.Invoice.SyncToken,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncError: null,
        },
      });
    } else {
      const payload = buildQboInvoicePayload(invoice, qboCustomerId, qboProjectId);
      const result = await qboRequest<{ Invoice: QboInvoice }>(
        "POST",
        "invoice",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.create({
        data: {
          entityType: "INVOICE",
          localId: invoiceId,
          qboId: result.Invoice.Id!,
          qboSyncToken: result.Invoice.SyncToken,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SUCCESS",
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.qboSyncRecord.upsert({
      where: {
        entityType_localId: {
          entityType: "INVOICE",
          localId: invoiceId,
        },
      },
      update: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
      create: {
        entityType: "INVOICE",
        localId: invoiceId,
        qboId: "",
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
    });
  }
}
