import { prisma } from "@/lib/prisma";
import { qboRequest } from "./client";
import type { QboPayment } from "./types";
import { mapPaidMethod } from "./types";

/**
 * Extract QBO Invoice IDs from a Payment's line items.
 */
export function extractInvoiceIdsFromPayment(payment: QboPayment): string[] {
  const invoiceIds: string[] = [];

  for (const line of payment.Line) {
    for (const txn of line.LinkedTxn) {
      if (txn.TxnType === "Invoice") {
        invoiceIds.push(txn.TxnId);
      }
    }
  }

  return invoiceIds;
}

/**
 * Fetch a QBO Payment and update linked local invoices to paid status.
 */
export async function handlePaymentUpdate(qboPaymentId: string): Promise<void> {
  const result = await qboRequest<{ Payment: QboPayment }>(
    "GET",
    "payment",
    qboPaymentId
  );

  const payment = result.Payment;
  const qboInvoiceIds = extractInvoiceIdsFromPayment(payment);

  if (qboInvoiceIds.length === 0) return;

  const syncRecords = await prisma.qboSyncRecord.findMany({
    where: {
      entityType: "INVOICE",
      qboId: { in: qboInvoiceIds },
    },
  });

  const paidMethod = mapPaidMethod(payment.PaymentMethodRef?.name);
  const paidAt = new Date(payment.TxnDate);

  for (const syncRecord of syncRecords) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: syncRecord.localId },
    });

    if (invoice && invoice.status !== "paid") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt,
          paidMethod,
        },
      });
    }
  }

  await prisma.qboSyncRecord.upsert({
    where: {
      entityType_localId: {
        entityType: "PAYMENT",
        localId: qboPaymentId,
      },
    },
    update: {
      lastSyncedAt: new Date(),
      lastSyncStatus: "SUCCESS",
      lastSyncError: null,
    },
    create: {
      entityType: "PAYMENT",
      localId: qboPaymentId,
      qboId: qboPaymentId,
      lastSyncedAt: new Date(),
      lastSyncStatus: "SUCCESS",
    },
  });
}
