"use client";

export default function PrintButton({ label = "Print Binder" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "8px 16px", cursor: "pointer" }}
    >
      {label}
    </button>
  );
}
