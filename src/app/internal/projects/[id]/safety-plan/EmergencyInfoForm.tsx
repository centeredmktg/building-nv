"use client";

import { useState } from "react";

export default function EmergencyInfoForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    nearestER: string | null;
    nearestERAddress: string | null;
    assemblyPoint: string | null;
  };
}) {
  const [form, setForm] = useState({
    nearestER: initial.nearestER ?? "",
    nearestERAddress: initial.nearestERAddress ?? "",
    assemblyPoint: initial.assemblyPoint ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Nearest ER name (e.g. Renown Regional Medical)"
          value={form.nearestER}
          onChange={set("nearestER")}
          className={inputClass}
        />
        <input
          placeholder="ER address (e.g. 1155 Mill St, Reno NV)"
          value={form.nearestERAddress}
          onChange={set("nearestERAddress")}
          className={inputClass}
        />
      </div>
      <input
        placeholder="Assembly point (e.g. parking lot on north side of building)"
        value={form.assemblyPoint}
        onChange={set("assemblyPoint")}
        className={inputClass}
      />
      <button
        onClick={save}
        disabled={saving}
        className="self-start bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Emergency Info"}
      </button>
    </div>
  );
}
