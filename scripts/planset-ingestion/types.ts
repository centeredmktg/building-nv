export type Unit = "SF" | "LF" | "EA" | "LS" | "HR" | "CY" | "SY";

export type TradeId =
  | "general_labor" | "carpentry" | "electrical" | "plumbing"
  | "hvac" | "painting" | "concrete" | "roofing"
  | "flooring" | "drywall" | "insulation" | "demolition"
  | "excavation" | "landscaping" | "fire_protection" | "low_voltage"
  | "glazing" | "masonry" | "welding" | "other";

export interface LineItemExtraction {
  description: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  vendorCost: number;
  isMaterial: boolean;
  sourceSheet: string;
  notes?: string;
}

export interface TradeSection {
  trade: TradeId;
  sectionTitle: string;
  lineItems: LineItemExtraction[];
}

export interface TaskExtraction {
  name: string;
  trade: TradeId;
  phase: string;
  durationDays: number;
  dependsOn: string[];
  isCriticalPath: boolean;
  isMilestoneTask: boolean;
}

export interface MilestoneExtraction {
  name: string;
  position: number;
  billingPercentage: number;
}

export interface PlansetExtraction {
  project: {
    name: string;
    shortCode: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    projectType: string;
    ownerFirstName: string;
    ownerLastName: string;
    ownerEmail?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    architect: string;
    engineer: string;
    interiorDesigner?: string;
    existingSqft: number;
    addedSqft: number;
    constructionType: string;
    bedrooms: number;
    bathrooms: number;
    specialRequirements: string[];
    hazardNotes?: string;
    nearestER?: string;
    nearestERAddress?: string;
  };
  quote: {
    title: string;
    scopeText: string;
    estimatedDuration: string;
    materialMarkupPct: number;
    overheadPct: number;
    profitPct: number;
  };
  trades: TradeSection[];
  tasks: TaskExtraction[];
  milestones: MilestoneExtraction[];
}

export type SheetType =
  | "site_plan" | "trpa_coverage" | "defensible_space" | "bmp"
  | "demo_plan" | "proposed_plan" | "elevation" | "keynotes"
  | "electrical" | "structural" | "interior_design" | "detail" | "unknown";

export interface ClassifiedSheet {
  pageNumber: number;
  sheetNumber: string;
  sheetType: SheetType;
  title: string;
  imagePath: string;
}
