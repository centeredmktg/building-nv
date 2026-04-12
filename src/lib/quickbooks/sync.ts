import { syncCustomer } from "./customers";
import { syncProject } from "./projects";
import { syncInvoice } from "./invoices";
import { handlePaymentUpdate } from "./payments";
import { prisma } from "@/lib/prisma";

/**
 * Check if QBO integration is configured.
 * Call this before attempting any sync to gracefully skip when not set up.
 */
export function shouldSync(): boolean {
  return Boolean(
    process.env.QBO_CLIENT_ID &&
    process.env.QBO_CLIENT_SECRET &&
    process.env.QBO_REDIRECT_URI
  );
}

/**
 * Check if there's an active QBO connection.
 */
export async function isConnected(): Promise<boolean> {
  if (!shouldSync()) return false;
  const connection = await prisma.qboConnection.findFirst({
    where: { isActive: true },
  });
  return Boolean(connection);
}

/**
 * Fire-and-forget sync wrapper. Logs errors but never throws.
 * Use this in API routes after local DB writes.
 */
export async function syncCustomerIfConnected(companyId: string): Promise<void> {
  if (!shouldSync()) return;
  if (!(await isConnected())) return;
  try {
    await syncCustomer(companyId);
  } catch (error) {
    console.error(`[QBO] Customer sync failed for ${companyId}:`, error);
  }
}

export async function syncProjectIfConnected(projectId: string): Promise<void> {
  if (!shouldSync()) return;
  if (!(await isConnected())) return;
  try {
    await syncProject(projectId);
  } catch (error) {
    console.error(`[QBO] Project sync failed for ${projectId}:`, error);
  }
}

export async function syncInvoiceIfConnected(invoiceId: string): Promise<void> {
  if (!shouldSync()) return;
  if (!(await isConnected())) return;
  try {
    await syncInvoice(invoiceId);
  } catch (error) {
    console.error(`[QBO] Invoice sync failed for ${invoiceId}:`, error);
  }
}

/**
 * Daily reconciliation: check all unpaid invoices that have been synced to QBO.
 * Fetches current QBO status and updates local records if payments found.
 */
export async function reconcilePayments(): Promise<{
  checked: number;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  const unpaidSyncRecords = await prisma.qboSyncRecord.findMany({
    where: {
      entityType: "INVOICE",
      lastSyncStatus: "SUCCESS",
      qboId: { not: "" },
    },
  });

  const recordsToCheck = [];
  for (const record of unpaidSyncRecords) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: record.localId },
    });
    if (invoice && invoice.status !== "paid") {
      recordsToCheck.push({ record, invoice });
    }
  }

  for (const { record } of recordsToCheck) {
    try {
      const { qboRequest } = await import("./client");
      const result = await qboRequest<{
        QueryResponse: {
          Payment?: Array<{ Id: string }>;
        };
      }>("GET", `query?query=${encodeURIComponent(
        `SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${record.qboId}'`
      )}`);

      const payments = result.QueryResponse.Payment;
      if (payments && payments.length > 0) {
        await handlePaymentUpdate(payments[0].Id);
        updated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Invoice ${record.localId}: ${message}`);
    }
  }

  return { checked: recordsToCheck.length, updated, errors };
}

// Re-export individual sync functions for direct use
export { syncCustomer, syncProject, syncInvoice, handlePaymentUpdate };
