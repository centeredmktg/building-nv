"use client";

import { useState } from "react";

interface FinancialFields {
  contractAmount: number | null;
  targetCostAmount: number | null;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  timingNotes: string | null;
}

function calcMargin(contract: number | null, target: number | null): string {
  if (!contract || !target || contract === 0) return "—";
  return `${(((contract - target) / contract) * 100).toFixed(1)}%`;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  return val.split("T")[0];
}

export default function FinancialSummarySection({
  projectId,
  initial,
  invoicedTotal,
}: {
  projectId: string;
  initial: FinancialFields;
  invoicedTotal?: number;
}) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async (updates: Partial<FinancialFields>) => {
    setSaving(true);
    const merged = { ...fields, ...updates };
    setFields(merged);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
  };

  return (
    <section>
      <h2 className="text-text-primary font-semibold text-base mb-3">Financial Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinancialField
          label="Contract Amount"
          value={fields.contractAmount != null ? fields.contractAmount.toString() : ""}
          type="number"
          placeholder="0"
          prefix="$"
          onSave={(v) => save({ contractAmount: v ? Number(v) : null })}
          saving={saving}
        />
        <FinancialField
          label="Target Cost"
          value={fields.targetCostAmount != null ? fields.targetCostAmount.toString() : ""}
          type="number"
          placeholder="0"
          prefix="$"
          onSave={(v) => save({ targetCostAmount: v ? Number(v) : null })}
          saving={saving}
        />
        <div>
          <p className="text-text-muted text-xs mb-1">Target Margin</p>
          <p className="text-text-primary text-sm font-medium">
            {calcMargin(fields.contractAmount, fields.targetCostAmount)}
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs mb-1">Uninvoiced</p>
          <p className="text-text-primary text-sm font-medium">
            {fields.contractAmount != null
              ? `$${(fields.contractAmount - (invoicedTotal ?? 0)).toLocaleString()}`
              : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <FinancialField
          label="Est. Start Date"
          value={toDateInput(fields.estimatedStartDate)}
          type="date"
          onSave={(v) => save({ estimatedStartDate: v || null })}
          saving={saving}
        />
        <FinancialField
          label="Est. End Date"
          value={toDateInput(fields.estimatedEndDate)}
          type="date"
          onSave={(v) => save({ estimatedEndDate: v || null })}
          saving={saving}
        />
        <FinancialField
          label="Timing Notes"
          value={fields.timingNotes ?? ""}
          type="text"
          placeholder="e.g. 12 weeks from permit approval"
          onSave={(v) => save({ timingNotes: v || null })}
          saving={saving}
        />
      </div>
    </section>
  );
}

function FinancialField({
  label,
  value,
  type,
  placeholder,
  prefix,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  type: "number" | "text" | "date";
  placeholder?: string;
  prefix?: string;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <div>
        <p className="text-text-muted text-xs mb-1">{label}</p>
        <input
          autoFocus
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-full bg-surface-2 border border-accent rounded-sm px-2 py-1 text-sm text-text-primary"
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        disabled={saving}
        className="text-text-primary text-sm font-medium hover:text-accent transition-colors text-left"
      >
        {prefix && value ? `${prefix}${Number(value).toLocaleString()}` : (value || "—")}
      </button>
    </div>
  );
}
