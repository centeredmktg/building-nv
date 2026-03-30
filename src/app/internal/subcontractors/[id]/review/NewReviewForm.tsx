"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  subId: string;
  projects: { id: string; name: string }[];
  reviewers: { id: string; firstName: string; lastName: string | null }[];
}

export default function NewReviewForm({ subId, projects, reviewers }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [projectId, setProjectId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [timeliness, setTimeliness] = useState(3);
  const [communication, setCommunication] = useState(3);
  const [price, setPrice] = useState(3);
  const [qualityOfWork, setQualityOfWork] = useState(3);
  const [wouldRehire, setWouldRehire] = useState(true);
  const [notes, setNotes] = useState("");

  const inputClass = "w-full border border-border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand";

  const RatingInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div>
      <label className="block text-sm text-text-muted mb-1">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-sm text-sm font-medium border transition-colors ${
              n <= value
                ? "bg-brand text-white border-brand"
                : "bg-white text-text-muted border-border hover:border-brand"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/subcontractors/${subId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, reviewerId, timeliness, communication, price, qualityOfWork, wouldRehire, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create review");
      }

      router.push(`/internal/subcontractors/${subId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-sm text-sm">{error}</div>}

      <section className="border border-border rounded-sm p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Project & Reviewer</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Project *</label>
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Reviewed by *</label>
            <select className={inputClass} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} required>
              <option value="">Select reviewer…</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="border border-border rounded-sm p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Ratings</h2>
        <div className="grid grid-cols-2 gap-6">
          <RatingInput label="Timeliness" value={timeliness} onChange={setTimeliness} />
          <RatingInput label="Communication" value={communication} onChange={setCommunication} />
          <RatingInput label="Price" value={price} onChange={setPrice} />
          <RatingInput label="Quality of Work" value={qualityOfWork} onChange={setQualityOfWork} />
        </div>
      </section>

      <section className="border border-border rounded-sm p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Overall</h2>
        <div className="mb-4">
          <label className="block text-sm text-text-muted mb-2">Would you hire this sub again?</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="rehire" checked={wouldRehire} onChange={() => setWouldRehire(true)} />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="rehire" checked={!wouldRehire} onChange={() => setWouldRehire(false)} />
              No
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">Notes</label>
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand text-white px-6 py-2 rounded-sm text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Submit Review"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-border px-6 py-2 rounded-sm text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
