import type { TradeId } from "../../src/lib/trades";

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unit: string; // "ea" | "ls" | "sf" | "lf" | "hr"
  unitPrice: number;
  tradeTag: TradeId;
  isAlternate: boolean;
}

export interface ExtractedQuote {
  slug: string;
  title: string;
  address: string;
  projectType: string;
  proposalDate: string; // ISO date
  customerCompany: string;
  overheadPct: number;
  profitPct: number;
  paymentTerms: string;
  exclusions: string;
  disclaimers: string[];
}

export interface ReviewFlags {
  totalMismatch: boolean;
  statedTotal: number;
  computedTotal: number;
  unknownTrades: string[];
}

export interface ExtractionResult {
  source: {
    pdfPath: string;
    extractedAt: string; // ISO datetime
    model: string;
  };
  quote: ExtractedQuote;
  lineItems: ExtractedLineItem[];
  reviewFlags: ReviewFlags;
}
