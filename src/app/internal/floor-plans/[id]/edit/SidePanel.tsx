"use client";

interface Props {
  name: string;
  projectName: string | null;
  onSave: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  isSaving: boolean;
  extractionNotes: string[];
}

export default function SidePanel({
  name,
  projectName,
  onSave,
  onExportPng,
  onExportPdf,
  isSaving,
  extractionNotes,
}: Props) {
  return (
    <div className="w-64 border-l border-border bg-surface p-4 flex flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-text-primary font-semibold text-sm">{name}</h2>
        {projectName && (
          <p className="text-text-muted text-xs mt-1">{projectName}</p>
        )}
      </div>
      {extractionNotes.length > 0 && (
        <div className="border border-orange-500/20 bg-orange-500/5 rounded-sm p-3">
          <p className="text-orange-400 text-xs font-medium mb-1">Extraction Notes</p>
          <ul className="text-text-muted text-xs space-y-1">
            {extractionNotes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onExportPng}
          className="border border-border text-text-primary font-medium px-4 py-2 rounded-sm text-sm hover:bg-surface transition-colors"
        >
          Export PNG
        </button>
        <button
          onClick={onExportPdf}
          className="border border-border text-text-primary font-medium px-4 py-2 rounded-sm text-sm hover:bg-surface transition-colors"
        >
          Export PDF
        </button>
      </div>
    </div>
  );
}
