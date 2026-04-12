"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  projects: { id: string; name: string }[];
}

export default function NewFloorPlanForm({ projects }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (!file) { setError("Please upload a scanned floor plan image"); return; }

    try {
      setStatus("uploading");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "floor-plans");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url: imageUrl } = await uploadRes.json();

      setStatus("extracting");
      const extractRes = await fetch("/api/floor-plans/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || "Extraction failed");
      }
      const { canvasData } = await extractRes.json();

      const createRes = await fetch("/api/floor-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || null,
          sourceImageUrl: imageUrl,
          canvasData,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create floor plan");
      const floorPlan = await createRes.json();

      router.push(`/internal/floor-plans/${floorPlan.id}/edit`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isProcessing = status === "uploading" || status === "extracting";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Kalter Residence - Main Floor"
          className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">
          Link to Project <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">Scanned Floor Plan</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-sm p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-64 mx-auto" />
          ) : (
            <div>
              <p className="text-text-muted text-sm">Click to upload or drag and drop</p>
              <p className="text-text-muted text-xs mt-1">JPEG or PNG, max 10MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={isProcessing}
        className="bg-accent text-bg font-semibold px-6 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "uploading" ? "Uploading..." : status === "extracting" ? "Extracting floor plan..." : "Extract & Create"}
      </button>
    </form>
  );
}
