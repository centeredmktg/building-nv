import { TRADES, type TradeId, getTradeLabel } from "../../src/lib/trades";

const SECTION_TITLE_OVERRIDES: Partial<Record<TradeId, string>> = {
  demolition: "Demo & Disposal",
  carpentry: "Framing & Carpentry",
  general_labor: "Equipment & Inspections",
  other: "Equipment & Inspections",
};

export function sectionTitleForTrade(trade: TradeId): string {
  return SECTION_TITLE_OVERRIDES[trade] ?? getTradeLabel(trade);
}

export function isKnownTrade(tag: string): tag is TradeId {
  return TRADES.some((t) => t.id === tag);
}

export function deriveSlug(address: string, projectType?: string | null): string {
  const base = address
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .trim()
    .split(/\s+/)
    .join("-");

  const isTI = projectType
    ? /^(t\.?i\.?|tenant\s*improvement)$/i.test(projectType.trim())
    : false;

  return isTI ? `${base}-ti` : base;
}
