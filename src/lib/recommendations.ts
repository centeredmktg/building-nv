import type { TradeId, TradeRecommendation, RecommendationId } from "./trades";

interface CapabilityRecord {
  trade: string;
  canPerform: boolean;
  capacityCheckAvailable: boolean;
}

interface SectionWithTrade {
  trade: string | null;
  items: { trade: string | null }[];
}

export function getTradeRecommendations(
  sections: SectionWithTrade[],
  capabilities: CapabilityRecord[],
): TradeRecommendation[] {
  // Collect unique trades from line items (item trade overrides section trade)
  const trades = new Set<TradeId>();

  for (const section of sections) {
    for (const item of section.items) {
      const trade = (item.trade ?? section.trade) as TradeId | null;
      if (trade) trades.add(trade);
    }
  }

  const capMap = new Map(capabilities.map((c) => [c.trade, c]));
  const recommendations: TradeRecommendation[] = [];

  for (const trade of trades) {
    const cap = capMap.get(trade);

    let recommendation: RecommendationId;
    let reason: string;

    if (!cap || !cap.canPerform) {
      recommendation = "sub_out";
      reason = "No in-house license";
    } else if (cap.capacityCheckAvailable) {
      // Future: check crew availability and return consider_sub if tight
      recommendation = "in_house";
      reason = "Licensed, capacity check unavailable";
    } else {
      recommendation = "in_house";
      reason = "Licensed, capacity check unavailable";
    }

    recommendations.push({ trade, recommendation, reason });
  }

  return recommendations;
}
