import { prisma } from "@/lib/prisma";
import { qboRequest } from "./client";
import { syncCustomer } from "./customers";
import type { QboProject } from "./types";

interface ProjectFields {
  id: string;
  name: string;
  shortCode: string | null;
  siteAddress: string | null;
}

export function buildQboProjectPayload(
  project: ProjectFields,
  qboCustomerId: string,
  qboId?: string,
  syncToken?: string
): QboProject {
  const payload: QboProject = {
    DisplayName: project.name,
    ParentRef: { value: qboCustomerId },
  };

  const descParts = [project.shortCode, project.siteAddress].filter(Boolean);
  if (descParts.length > 0) {
    payload.Description = descParts.join(" — ");
  }

  if (qboId) payload.Id = qboId;
  if (syncToken) payload.SyncToken = syncToken;

  return payload;
}

/**
 * Resolve the QBO Customer ID for a project's customer company.
 * If the customer hasn't been synced yet, syncs it first.
 */
async function ensureCustomerSynced(projectId: string): Promise<string> {
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

  if (customerSync && customerSync.lastSyncStatus === "SUCCESS" && customerSync.qboId) {
    return customerSync.qboId;
  }

  await syncCustomer(projectCompany.companyId);

  const newSync = await prisma.qboSyncRecord.findUnique({
    where: {
      entityType_localId: {
        entityType: "CUSTOMER",
        localId: projectCompany.companyId,
      },
    },
  });

  if (!newSync || newSync.lastSyncStatus !== "SUCCESS" || !newSync.qboId) {
    throw new Error(`Failed to sync customer company ${projectCompany.companyId} to QBO`);
  }

  return newSync.qboId;
}

/**
 * Sync a Project to QBO. Ensures parent Customer exists first.
 * Non-blocking — records failure but does not throw.
 */
export async function syncProject(projectId: string): Promise<void> {
  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const qboCustomerId = await ensureCustomerSynced(projectId);

    const existingSync = await prisma.qboSyncRecord.findUnique({
      where: {
        entityType_localId: {
          entityType: "PROJECT",
          localId: projectId,
        },
      },
    });

    if (existingSync) {
      const payload = buildQboProjectPayload(
        project,
        qboCustomerId,
        existingSync.qboId,
        existingSync.qboSyncToken ?? undefined
      );
      const result = await qboRequest<{ Project: QboProject }>(
        "POST",
        "project",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.update({
        where: { id: existingSync.id },
        data: {
          qboSyncToken: result.Project.SyncToken,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncError: null,
        },
      });
    } else {
      const payload = buildQboProjectPayload(project, qboCustomerId);
      const result = await qboRequest<{ Project: QboProject }>(
        "POST",
        "project",
        undefined,
        payload
      );

      await prisma.qboSyncRecord.create({
        data: {
          entityType: "PROJECT",
          localId: projectId,
          qboId: result.Project.Id!,
          qboSyncToken: result.Project.SyncToken,
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
          entityType: "PROJECT",
          localId: projectId,
        },
      },
      update: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
      create: {
        entityType: "PROJECT",
        localId: projectId,
        qboId: "",
        lastSyncedAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
    });
  }
}
