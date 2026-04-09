"use client";

import { useState, useMemo } from "react";
import { TRADES } from "@/lib/trades";
import { DETAIL_TYPES, CSI_DIVISIONS } from "@/lib/detail-library";

interface DetailItem {
  id: string;
  name: string;
  description: string | null;
  manufacturer: string;
  trade: string;
  csiDivision: string | null;
  csiTitle: string | null;
  detailType: string;
  format: string;
  sourceUrl: string;
  tags: string[];
  isFree: boolean;
  notes: string | null;
}

export default function DetailFilters({ items }: { items: DetailItem[] }) {
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("");
  const [detailType, setDetailType] = useState("");
  const [csiDivision, setCsiDivision] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (trade && item.trade !== trade) return false;
      if (detailType && item.detailType !== detailType) return false;
      if (csiDivision && item.csiDivision !== csiDivision) return false;
      if (search) {
        const q = search.toLowerCase();
        const searchable = [
          item.name,
          item.manufacturer,
          item.description ?? "",
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, trade, detailType, csiDivision]);

  const activeFilterCount = [trade, detailType, csiDivision, search].filter(Boolean).length;

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-muted w-64 focus:outline-none focus:border-accent"
        />
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Trades</option>
          {TRADES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={detailType}
          onChange={(e) => setDetailType(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Types</option>
          {DETAIL_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={csiDivision}
          onChange={(e) => setCsiDivision(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All CSI Divisions</option>
          {CSI_DIVISIONS.map((d) => (
            <option key={d.code} value={d.code}>
              Div {d.code} — {d.title}
            </option>
          ))}
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setSearch("");
              setTrade("");
              setDetailType("");
              setCsiDivision("");
            }}
            className="text-text-muted hover:text-text-primary text-sm transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-text-muted text-sm mb-4">
        {filtered.length} detail{filtered.length !== 1 ? "s" : ""}
        {activeFilterCount > 0 ? " matching filters" : ""}
      </p>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted">No details match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-sm p-5 hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-text-primary font-medium text-sm group-hover:text-accent transition-colors">
                  {item.name}
                </h3>
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-surface border border-border text-text-muted shrink-0">
                  {item.format}
                </span>
              </div>
              <p className="text-text-muted text-xs mb-3">
                {item.manufacturer}
                {item.csiDivision ? ` · Div ${item.csiDivision}` : ""}
              </p>
              {item.description && (
                <p className="text-text-muted text-xs mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/20">
                  {item.detailType}
                </span>
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded-sm bg-surface border border-border text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-xs text-text-muted">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="text-text-muted text-xs mt-2 italic">{item.notes}</p>
              )}
              {!item.isFree && (
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-400 border border-orange-500/20 mt-2 inline-block">
                  Paid
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
