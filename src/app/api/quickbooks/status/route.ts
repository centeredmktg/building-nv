import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.qboConnection.findFirst({
    where: { isActive: true },
  });

  if (!connection) {
    return NextResponse.json({
      connected: false,
    });
  }

  const [totalSynced, failedSyncs, recentSyncs] = await Promise.all([
    prisma.qboSyncRecord.count({
      where: { lastSyncStatus: "SUCCESS" },
    }),
    prisma.qboSyncRecord.findMany({
      where: { lastSyncStatus: "FAILED" },
      orderBy: { lastSyncedAt: "desc" },
    }),
    prisma.qboSyncRecord.findMany({
      orderBy: { lastSyncedAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    connected: true,
    companyName: connection.companyName,
    realmId: connection.realmId,
    connectedAt: connection.connectedAt,
    connectedBy: connection.connectedBy,
    tokenExpiresAt: connection.accessTokenExpiresAt,
    refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    sync: {
      totalSynced,
      failedCount: failedSyncs.length,
      failedSyncs: failedSyncs.map((s) => ({
        id: s.id,
        entityType: s.entityType,
        localId: s.localId,
        lastSyncedAt: s.lastSyncedAt,
        lastSyncError: s.lastSyncError,
      })),
      recentSyncs: recentSyncs.map((s) => ({
        id: s.id,
        entityType: s.entityType,
        localId: s.localId,
        qboId: s.qboId,
        lastSyncedAt: s.lastSyncedAt,
        lastSyncStatus: s.lastSyncStatus,
      })),
    },
  });
}
