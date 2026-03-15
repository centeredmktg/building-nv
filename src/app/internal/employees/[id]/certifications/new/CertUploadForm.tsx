"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CertUploadForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "OSHA_10",
    issueDate: "",
    expirationDate: "",
  });
  const [cardPhotoUrl, setCardPhotoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const requiresPhoto = form.type === "OSHA_10" || form.type === "OSHA_30";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "certifications");

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      setCardPhotoUrl(data.url);
      setFileName(file.name);
    } else {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresPhoto && !cardPhotoUrl) {
      setError("Card photo is required for OSHA 10 and OSHA 30 certifications.");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch(`/api/employees/${employeeId}/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, cardPhotoUrl }),
    });

    if (res.ok) {
      router.push(`/internal/employees/${employeeId}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <select
        value={form.type}
        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
        className={`${inputClass} appearance-none`}
      >
        <option value="OSHA_10">OSHA 10-Hour</option>
        <option value="OSHA_30">OSHA 30-Hour</option>
        <option value="FIRST_AID">First Aid / CPR</option>
        <option value="OTHER">Other</option>
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-muted text-xs mb-1 block">Issue Date *</label>
          <input
            type="date"
            required
            value={form.issueDate}
            onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-text-muted text-xs mb-1 block">Expiry Date (if applicable)</label>
          <input
            type="date"
            value={form.expirationDate}
            onChange={(e) => setForm((p) => ({ ...p, expirationDate: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-text-muted text-xs mb-1 block">
          Card Photo {requiresPhoto ? <span className="text-red-400">* Required for OSHA certs</span> : "(optional)"}
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-text-muted text-sm"
        />
        {uploading && <p className="text-text-muted text-xs mt-1">Uploading...</p>}
        {cardPhotoUrl && (
          <p className="text-green-400 text-xs mt-1">✓ Uploaded: {fileName}</p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Certification"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-text-muted text-sm hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
