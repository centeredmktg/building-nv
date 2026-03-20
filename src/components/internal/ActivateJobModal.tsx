"use client";

import { useState } from "react";
import { CRMProject, JobProject } from "@/lib/crmTypes";

type AnyProject = CRMProject | JobProject;

interface ActivateJobModalProps {
  project: AnyProject;
  onClose: () => void;
  onActivated: () => void;
}

function getAcceptedQuoteTotal(project: AnyProject): number | null {
  const quotes = (project as any).quotes ?? [];
  const accepted = quotes.find((q: { status: string }) => q.status === "accepted");
  if (!accepted) return null;
  return accepted.sections
    .flatMap((s: { items: { quantity: number; unitPrice: number }[] }) => s.items)
    .reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0);
}

function getAcceptedQuoteStartDate(project: AnyProject): string {
  const quotes = (project as any).quotes ?? [];
  const accepted = quotes.find((q: { status: string; estimatedStartDate?: string | null }) => q.status === "accepted");
  if (!accepted?.estimatedStartDate) return "";
  return accepted.estimatedStartDate.split("T")[0];
}

// Parse durations like "8 weeks", "3 months", "90 days" → number of days (null if unparseable)
function parseDurationDays(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const lower = duration.toLowerCase().trim();
  const match = lower.match(/^(\d+)\s*(day|week|month)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (match[2].startsWith("week")) return n * 7;
  if (match[2].startsWith("month")) return n * 30;
  return n; // days
}

function getAcceptedQuoteEndDate(project: AnyProject): string {
  const quotes = (project as any).quotes ?? [];
  const accepted = quotes.find(
    (q: { status: string; estimatedStartDate?: string | null; estimatedDuration?: string | null }) =>
      q.status === "accepted"
  );
  if (!accepted?.estimatedStartDate) return "";
  const days = parseDurationDays(accepted.estimatedDuration);
  if (!days) return "";
  const start = new Date(accepted.estimatedStartDate);
  start.setDate(start.getDate() + days);
  return start.toISOString().split("T")[0];
}

export default function ActivateJobModal({ project, onClose, onActivated }: ActivateJobModalProps) {
  // Note: project.contractAmount may already be set if activated before. Pre-fill from quote total if available.
  const quoteTotal = getAcceptedQuoteTotal(project);
  const quoteStartDate = getAcceptedQuoteStartDate(project);
  const quoteEndDate = getAcceptedQuoteEndDate(project);

  const [contractAmount, setContractAmount] = useState(quoteTotal?.toString() ?? "");
  const [targetCostAmount, setTargetCostAmount] = useState("");
  const [estimatedStartDate, setEstimatedStartDate] = useState(quoteStartDate);
  const [estimatedEndDate, setEstimatedEndDate] = useState(quoteEndDate);
  const [timingNotes, setTimingNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAmount: Number(contractAmount),
          targetCostAmount: Number(targetCostAmount),
          estimatedStartDate: estimatedStartDate || null,
          estimatedEndDate: estimatedEndDate || null,
          timingNotes: timingNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Activation failed");
        return;
      }

      onActivated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-sm w-full max-w-md p-6">
        <h2 className="text-text-primary font-bold text-lg mb-1">Activate Job</h2>
        <p className="text-text-muted text-sm mb-5">{project.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Contract Amount *</label>
            <input
              type="number"
              required
              value={contractAmount}
              onChange={(e) => setContractAmount(e.target.value)}
              placeholder="85000"
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="text-text-muted text-xs mb-1 block">Target Cost *</label>
            <input
              type="number"
              required
              value={targetCostAmount}
              onChange={(e) => setTargetCostAmount(e.target.value)}
              placeholder="60000"
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-text-muted text-xs mb-1 block">Est. Start Date</label>
              <input
                type="date"
                value={estimatedStartDate}
                onChange={(e) => setEstimatedStartDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-text-muted text-xs mb-1 block">Est. End Date</label>
              <input
                type="date"
                value={estimatedEndDate}
                onChange={(e) => setEstimatedEndDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-text-muted text-xs mb-1 block">Timing Notes</label>
            <input
              type="text"
              value={timingNotes}
              onChange={(e) => setTimingNotes(e.target.value)}
              placeholder="e.g. 12 weeks from permit approval"
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-sm py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-accent text-white rounded-sm py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Activating..." : "Activate Job →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
