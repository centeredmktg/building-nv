export interface MilestoneInput {
  title: string;
}

export interface GeneratedMilestone {
  name: string;
  weekNumber: number;
  duration: string | null;
  paymentPct: number;
  paymentLabel: string;
  position: number;
}

const TRADE_DURATIONS: Record<string, string> = {
  demolition: "3-5 days",
  "paint & drywall": "5-7 days",
  painting: "5-7 days",
  drywall: "5-7 days",
  flooring: "5-8 days",
  ceiling: "2-3 days",
  electrical: "3-5 days",
  plumbing: "3-5 days",
  framing: "5-7 days",
  "finish carpentry": "3-5 days",
  hvac: "3-5 days",
  roofing: "5-7 days",
  siding: "5-7 days",
  insulation: "2-3 days",
  cabinets: "3-5 days",
  countertops: "2-3 days",
  tile: "5-7 days",
};

const DEFAULT_DURATION = "3-5 days";

/**
 * Parse a duration string like "3-5 days" into fractional weeks.
 * Uses the average of the range divided by 7.
 */
export function durationToWeeks(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)\s*-\s*(\d+)\s*days?/i);
  if (match) {
    const avg = (parseInt(match[1]) + parseInt(match[2])) / 2;
    return Math.round((avg / 7) * 100) / 100;
  }
  const single = duration.match(/(\d+)\s*days?/i);
  if (single) return Math.round((parseInt(single[1]) / 7) * 100) / 100;
  const weeks = duration.match(/(\d+)\s*weeks?/i);
  if (weeks) return parseInt(weeks[1]);
  return 0;
}

function lookupDuration(title: string): string {
  const key = title.toLowerCase().trim();
  for (const [trade, dur] of Object.entries(TRADE_DURATIONS)) {
    if (key.includes(trade) || trade.includes(key)) return dur;
  }
  return DEFAULT_DURATION;
}

/**
 * Default payment split: 10% signing, 5% final walkthrough,
 * remaining 85% distributed across scope phases.
 */
function distributePayments(phaseCount: number): number[] {
  const signingPct = 10;
  const finalPct = 5;
  const remaining = 85;

  if (phaseCount === 0) return [signingPct, finalPct];

  const perPhase = Math.floor(remaining / phaseCount);
  const remainder = remaining - perPhase * phaseCount;

  const phasePcts: number[] = [];
  for (let i = 0; i < phaseCount; i++) {
    phasePcts.push(perPhase + (i < remainder ? 1 : 0));
  }

  return [signingPct, ...phasePcts, finalPct];
}

const PHASE_LABELS = [
  "Materials Purchase",
  "Phase 2 Progress",
  "Phase 3 Progress",
  "Phase 4 Progress",
  "Phase 5 Progress",
  "Phase 6 Progress",
  "Phase 7 Progress",
  "Phase 8 Progress",
];

export function generateMilestones(sections: MilestoneInput[]): GeneratedMilestone[] {
  const paymentPcts = distributePayments(sections.length);
  const milestones: GeneratedMilestone[] = [];

  milestones.push({
    name: "Contract Signed",
    weekNumber: 0,
    duration: null,
    paymentPct: paymentPcts[0],
    paymentLabel: "Contract Signing",
    position: 0,
  });

  sections.forEach((sec, i) => {
    milestones.push({
      name: sec.title,
      weekNumber: i + 1,
      duration: lookupDuration(sec.title),
      paymentPct: paymentPcts[i + 1],
      paymentLabel: PHASE_LABELS[i] ?? `Phase ${i + 2} Progress`,
      position: i + 1,
    });
  });

  milestones.push({
    name: "Final Walkthrough & Punch List",
    weekNumber: sections.length + 1,
    duration: "1-2 days",
    paymentPct: paymentPcts[paymentPcts.length - 1],
    paymentLabel: "Project Completion",
    position: sections.length + 1,
  });

  return milestones;
}
