"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface SyncRecord {
  id: string;
  entityType: string;
  localId: string;
  qboId: string;
  lastSyncedAt: string;
  lastSyncStatus: string;
  lastSyncError?: string;
}

interface QboStatus {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  connectedAt?: string;
  connectedBy?: string;
  sync?: {
    totalSynced: number;
    failedCount: number;
    failedSyncs: SyncRecord[];
    recentSyncs: SyncRecord[];
  };
}

export default function QuickBooksSettingsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<QboStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  async function fetchStatus() {
    const res = await fetch("/api/quickbooks/status");
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleDisconnect() {
    if (!confirm("Disconnect from QuickBooks? Sync will stop until reconnected.")) return;
    await fetch("/api/quickbooks/disconnect", { method: "POST" });
    fetchStatus();
  }

  async function handleRetry(syncRecordId: string) {
    setRetrying(syncRecordId);
    await fetch("/api/quickbooks/sync/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncRecordId }),
    });
    setRetrying(null);
    fetchStatus();
  }

  async function handleReconcile() {
    setReconciling(true);
    await fetch("/api/quickbooks/sync/reconcile", { method: "POST" });
    setReconciling(false);
    fetchStatus();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">QuickBooks Online</h1>
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">QuickBooks Online</h1>

      {connected && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          Successfully connected to QuickBooks.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Connection failed. Please try again.
        </div>
      )}

      {!status?.connected ? (
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <p className="text-text-secondary">
            Connect to QuickBooks Online to automatically sync customers, projects, and invoices.
            Payment status from QBO will flow back to keep your records current.
          </p>
          <a
            href="/api/quickbooks/auth"
            className="inline-block bg-text-primary text-bg px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Connect to QuickBooks
          </a>
        </div>
      ) : (
        <>
          {/* Connection Info */}
          <div className="bg-surface border border-border rounded-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {status.companyName}
                </h2>
                <p className="text-text-muted text-sm">
                  Connected {new Date(status.connectedAt!).toLocaleDateString()} by{" "}
                  {status.connectedBy}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-red-600 text-sm hover:text-red-700 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Sync Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Synced Entities</p>
              <p className="text-2xl font-bold text-text-primary">
                {status.sync?.totalSynced ?? 0}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Failed Syncs</p>
              <p className={`text-2xl font-bold ${
                (status.sync?.failedCount ?? 0) > 0 ? "text-red-600" : "text-text-primary"
              }`}>
                {status.sync?.failedCount ?? 0}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Payment Reconciliation</p>
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="mt-1 text-sm text-text-primary underline hover:no-underline disabled:opacity-50"
              >
                {reconciling ? "Running..." : "Run Now"}
              </button>
            </div>
          </div>

          {/* Failed Syncs */}
          {status.sync && status.sync.failedSyncs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Failed Syncs</h2>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {status.sync.failedSyncs.map((sync) => (
                  <div key={sync.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {sync.entityType} — {sync.localId}
                      </p>
                      <p className="text-sm text-red-600">{sync.lastSyncError}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(sync.lastSyncedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRetry(sync.id)}
                      disabled={retrying === sync.id}
                      className="text-sm text-text-primary underline hover:no-underline disabled:opacity-50"
                    >
                      {retrying === sync.id ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Syncs */}
          {status.sync && status.sync.recentSyncs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Recent Syncs</h2>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {status.sync.recentSyncs.map((sync) => (
                  <div key={sync.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {sync.entityType}
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(sync.lastSyncedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        sync.lastSyncStatus === "SUCCESS"
                          ? "bg-green-100 text-green-700"
                          : sync.lastSyncStatus === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {sync.lastSyncStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
