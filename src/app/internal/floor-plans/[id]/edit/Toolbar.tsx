"use client";

export type Tool = "select" | "editDimension" | "addLabel" | "delete";

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showBackground: boolean;
  onToggleBackground: () => void;
}

const TOOLS: { id: Tool; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "editDimension", label: "Edit Dimension", shortcut: "D" },
  { id: "addLabel", label: "Add Label", shortcut: "L" },
  { id: "delete", label: "Delete", shortcut: "⌫" },
];

export default function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showBackground,
  onToggleBackground,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
              activeTool === tool.id
                ? "bg-accent text-bg"
                : "text-text-muted hover:text-text-primary hover:bg-surface"
            }`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div className="w-px h-6 bg-border mx-2" />
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Shift+Z)"
      >
        Redo
      </button>
      <div className="w-px h-6 bg-border mx-2" />
      <button
        onClick={onToggleBackground}
        className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
          showBackground
            ? "bg-accent/20 text-accent border border-accent/30"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        {showBackground ? "Hide Scan" : "Show Scan"}
      </button>
    </div>
  );
}
