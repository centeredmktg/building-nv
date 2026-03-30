export const TRADES = [
  { id: "general_labor", label: "General Labor" },
  { id: "carpentry", label: "Carpentry" },
  { id: "electrical", label: "Electrical" },
  { id: "plumbing", label: "Plumbing" },
  { id: "hvac", label: "HVAC" },
  { id: "painting", label: "Painting" },
  { id: "concrete", label: "Concrete" },
  { id: "roofing", label: "Roofing" },
  { id: "flooring", label: "Flooring" },
  { id: "drywall", label: "Drywall" },
  { id: "insulation", label: "Insulation" },
  { id: "demolition", label: "Demolition" },
  { id: "excavation", label: "Excavation" },
  { id: "landscaping", label: "Landscaping" },
  { id: "fire_protection", label: "Fire Protection" },
  { id: "low_voltage", label: "Low Voltage" },
  { id: "glazing", label: "Glazing" },
  { id: "masonry", label: "Masonry" },
  { id: "welding", label: "Welding" },
  { id: "other", label: "Other" },
] as const;

export type TradeId = (typeof TRADES)[number]["id"];

export function getTradeLabel(id: TradeId): string {
  return TRADES.find((t) => t.id === id)?.label ?? id;
}

export const ONBOARDING_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "documents_requested", label: "Documents Requested" },
  { id: "under_review", label: "Under Review" },
  { id: "approved", label: "Approved" },
  { id: "suspended", label: "Suspended" },
] as const;

export type OnboardingStatusId = (typeof ONBOARDING_STATUSES)[number]["id"];

export const RECOMMENDATION_TYPES = [
  { id: "in_house", label: "In-House" },
  { id: "sub_out", label: "Sub Out" },
  { id: "consider_sub", label: "Consider Sub" },
] as const;

export type RecommendationId = (typeof RECOMMENDATION_TYPES)[number]["id"];

export interface TradeRecommendation {
  trade: TradeId;
  recommendation: RecommendationId;
  reason: string;
}
