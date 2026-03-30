import type { ComplianceRule, ProjectContext, RuleMatch } from "./types";

const BID_LIMIT = 1_400_000; // CPP license #0092515
const RESTROOM_KEYWORDS = ["restroom", "bathroom", "lavatory", "toilet", "washroom"];
const CONTRACT_100K_THRESHOLD = 100_000;

function keywordInText(keyword: string, text: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

function scanKeywords(
  keywords: string[],
  sections: ProjectContext["scopeSections"]
): { matchedOn: string[]; matchedTask: string | undefined } {
  const matchedOn: string[] = [];
  let matchedTask: string | undefined;

  for (const keyword of keywords) {
    for (const section of sections) {
      if (keywordInText(keyword, section.title)) {
        matchedOn.push(`keyword:${keyword}`);
        matchedTask = matchedTask ?? section.title;
      }
      for (const item of section.items) {
        if (keywordInText(keyword, item.description)) {
          matchedOn.push(`keyword:${keyword}`);
          matchedTask = matchedTask ?? section.title;
        }
      }
    }
  }

  return { matchedOn: [...new Set(matchedOn)], matchedTask };
}

function evaluateConditions(
  conditions: string[],
  ctx: ProjectContext
): string[] {
  const matched: string[] = [];

  for (const condition of conditions) {
    switch (condition) {
      case "government_tenant": {
        const isGovTenant = ctx.companyRoles?.some(
          (cr) => cr.type === "government" && cr.role === "tenant"
        );
        if (isGovTenant) matched.push(`condition:${condition}`);
        break;
      }
      case "contract_above_bid_limit": {
        if (ctx.contractAmount != null && ctx.contractAmount > BID_LIMIT) {
          matched.push(`condition:${condition}`);
        }
        break;
      }
      case "contract_above_100k": {
        if (ctx.contractAmount != null && ctx.contractAmount > CONTRACT_100K_THRESHOLD) {
          matched.push(`condition:${condition}`);
        }
        break;
      }
      case "public_works": {
        const isPublic = ctx.companyRoles?.some(
          (cr) => cr.type === "government" || cr.role === "government"
        );
        if (isPublic) matched.push(`condition:${condition}`);
        break;
      }
      case "restroom_in_scope": {
        const hasRestroom = ctx.scopeSections.some((section) => {
          if (RESTROOM_KEYWORDS.some((kw) => keywordInText(kw, section.title))) return true;
          return section.items.some((item) =>
            RESTROOM_KEYWORDS.some((kw) => keywordInText(kw, item.description))
          );
        });
        if (hasRestroom) matched.push(`condition:${condition}`);
        break;
      }
    }
  }

  return matched;
}

export function matchRules(
  rules: ComplianceRule[],
  ctx: ProjectContext
): RuleMatch[] {
  const matchMap = new Map<string, RuleMatch>();

  for (const rule of rules) {
    const allMatchedOn: string[] = [];
    let matchedTask: string | undefined;

    // Step 1: Keyword scan
    if (rule.triggers.scope_keywords.length > 0) {
      const kwResult = scanKeywords(rule.triggers.scope_keywords, ctx.scopeSections);
      allMatchedOn.push(...kwResult.matchedOn);
      matchedTask = kwResult.matchedTask;
    }

    // Step 2: Condition evaluation
    if (rule.triggers.conditions.length > 0) {
      const condMatches = evaluateConditions(rule.triggers.conditions, ctx);
      allMatchedOn.push(...condMatches);
    }

    const hasKeywordMatch = allMatchedOn.some((m) => m.startsWith("keyword:"));
    const hasConditionMatch = allMatchedOn.some((m) => m.startsWith("condition:"));
    const hasKeywords = rule.triggers.scope_keywords.length > 0;
    const hasConditions = rule.triggers.conditions.length > 0;

    let matches = false;
    if (hasKeywords && hasConditions) {
      matches = hasKeywordMatch || hasConditionMatch;
    } else if (hasKeywords) {
      matches = hasKeywordMatch;
    } else if (hasConditions) {
      matches = hasConditionMatch;
    }

    if (!matches) continue;

    // Step 3: Project type filter
    if (rule.triggers.project_types.length > 0) {
      const typeMatch = rule.triggers.project_types.some(
        (t) => t.toLowerCase() === ctx.projectType.toLowerCase()
      );
      if (!typeMatch) continue;
    }

    // Step 4: Deduplicate
    const existing = matchMap.get(rule.id);
    if (existing) {
      const mergedOn = [...new Set([...existing.matchedOn, ...allMatchedOn])];
      matchMap.set(rule.id, { ...existing, matchedOn: mergedOn });
    } else {
      matchMap.set(rule.id, { rule, matchedOn: allMatchedOn, matchedTask });
    }
  }

  return Array.from(matchMap.values());
}
