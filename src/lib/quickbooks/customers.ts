import { prisma } from "@/lib/prisma";
import { qboRequest } from "./client";
import type { QboCustomer } from "./types";

interface CompanyFields {
  id: string;
  name: string;
  phone: string | null;
  domain: string | null;
}

export function buildQboCustomerPayload(
  company: CompanyFields,
  primaryEmail: string | null,
  qboId?: string,
  syncToken?: string
): QboCustomer {
  const payload: QboCustomer = {
    DisplayName: company.name,
    CompanyName: company.name,
  };

  if (company.phone) {
    payload.PrimaryPhone = { FreeFormNumber: company.phone };
  }
  if (primaryEmail) {
    payload.PrimaryEmailAddr = { Address: primaryEmail };
  }
  if (company.domain) {
    payload.WebAddr = { URI: company.domain };
  }
  if (qboId) payload.Id = qboId;
  if (syncToken) payload.SyncToken = syncToken;

  return payload;
}

/**
 * Sync a Company to QBO as a Customer.
 * Creates or updates based on existing QboSyncRecord.
 * Non-blocking — records failure but does not throw.
 */
export async function syncCustomer(companyId: string): Promise<void> {
  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: {
        contacts: {
          where: { type: "customer" },
          take: 1,
        },
      },
    });

    const primaryEmail = company.contacts[0]?.email ?? null;

    // Check for existing sync record
    const existingSync = await prisma.qboSyncRecord.findUnique({
      where: {
        entityType_localId: {
          entityType: "CUSTOMER",
          localId: companyId,
        },
      },
    });

    if (existingSync) {
      // Update existing QBO Customer
      const payload = buildQboCustomerPayload(
        company,
        primaryEmail,
        existingSync.qboId,
        existingSync.qboSyncToken ?? undefined
      );
      const result = await qboRequest<{ Customer: QboCustomer }>(
        "POST",
        "customer",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.update({
        where: { id: existingSync.id },
        data: {
          qboSyncToken: result.Customer.SyncToken,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncError: null,
        },
      });
    } else {
      // Create new QBO Customer
      const payload = buildQboCustomerPayload(company, primaryEmail);
      const result = await qboRequest<{ Customer: QboCustomer }>(
        "POST",
        "customer",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.create({
        data: {
          entityType: "CUSTOMER",
          localId: companyId,
          qboId: result.Customer.Id!,
          qboSyncToken: result.Customer.SyncToken,
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
          entityType: "CUSTOMER",
          localId: companyId,
        },
      },
      update: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
      create: {
        entityType: "CUSTOMER",
        localId: companyId,
        qboId: "",
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
    });
  }
}
