"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface JobApplication {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  resumeUrl: string;
  createdAt: string;
}

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  status: string;
  applications: JobApplication[];
  _count: { applications: number };
}

export default function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", type: "", status: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/job-postings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPosting(data);
        setForm({
          title: data.title,
          description: data.description,
          location: data.location,
          type: data.type,
          status: data.status,
        });
      });
  }, [id]);

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/job-postings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setPosting({ ...posting!, ...updated, applications: posting!.applications });
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    }
    setSaving(false);
  };

  if (!posting) {
    return <p className="text-text-muted">Loading...</p>;
  }

  return (
    <div>
      <Link href="/internal/careers" className="text-text-muted text-sm hover:text-text-primary transition-colors mb-6 inline-block">
        &larr; All Postings
      </Link>

      {/* Posting details */}
      <div className="mb-10">
        {editing ? (
          <div className="max-w-lg flex flex-col gap-4">
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
              placeholder="Title"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className={`${inputClass} resize-none`}
              rows={6}
              placeholder="Description"
            />
            <input
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className={inputClass}
              placeholder="Location"
            />
            <div className="flex gap-4">
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className={inputClass}
              >
                {["full-time", "part-time", "contract"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className={inputClass}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-text-muted text-sm hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">{posting.title}</h1>
                <p className="text-text-muted text-sm mt-1">
                  {posting.location} · {posting.type}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-sm ${
                    posting.status === "open"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {posting.status === "open" ? "Open" : "Closed"}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-accent text-sm hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
            <p className="text-text-muted text-sm whitespace-pre-wrap max-w-2xl">{posting.description}</p>
          </div>
        )}
      </div>

      {/* Applications list */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Applications ({posting.applications.length})
        </h2>

        {posting.applications.length === 0 ? (
          <div className="border border-border rounded-sm p-8 text-center">
            <p className="text-text-muted text-sm">No applications yet.</p>
          </div>
        ) : (
          <div className="border border-border rounded-sm divide-y divide-border">
            {posting.applications.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="text-text-primary font-medium">{app.name}</p>
                  <p className="text-text-muted text-sm mt-0.5">
                    {app.email}
                    {app.phone && ` · ${app.phone}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-text-muted text-xs">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  <a
                    href={app.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent text-sm hover:underline"
                  >
                    Resume
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
