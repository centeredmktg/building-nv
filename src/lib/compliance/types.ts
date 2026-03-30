export interface ComplianceRule {
  id: string;
  title: string;
  severity: "BLOCK" | "WARNING" | "INFO";
  citation: string;
  domain: string;
  triggers: {
    scope_keywords: string[];
    project_types: string[];
    conditions: string[];
  };
  action: string;
  body: string; // markdown content for chatbot context
}

export interface ReferenceDoc {
  id: string;
  title: string;
  domain: string;
  body: string;
}

export interface ProjectContext {
  projectType: string;
  scopeSections: {
    title: string;
    items: { description: string }[];
  }[];
  contractAmount?: number;
  companyRoles?: { type: string; role: string }[];
  siteAddress?: string;
}

export interface RuleMatch {
  rule: ComplianceRule;
  matchedOn: string[]; // e.g. ["keyword:demolition", "condition:government_tenant"]
  matchedTask?: string; // which scope section/item triggered it
}

export type Severity = "BLOCK" | "WARNING" | "INFO";

export interface GeneratedTask {
  name: string;
  phase: string;
  position: number;
  durationDays: number;
  startDay: number;
  endDay: number;
  dependsOnPositions: number[];
  milestoneId?: string;
  isMilestoneTask: boolean;
  isCriticalPath: boolean;
  complianceFlags: {
    ruleId: string;
    severity: Severity;
    title: string;
    citation: string;
    actionItem: string;
  }[];
}

export interface GeneratedPlan {
  tasks: GeneratedTask[];
  totalDurationDays: number;
  criticalPath: string[]; // task names in order
}

export interface ChatResponse {
  reply: string;
  citations: { ruleId: string; citation: string; title: string }[];
  severity?: Severity;
}

export interface VectorChunk {
  id: string; // sourceId + chunk index
  sourceId: string; // rule or reference doc id
  sourceType: "rule" | "reference";
  text: string;
  embedding: number[];
}
