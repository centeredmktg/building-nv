# Compliance Chatbot & Project Plan Generator — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Author:** Danny Cox + Claude

---

## Overview

Two features that consume a shared compliance reference corpus:

1. **Compliance Chatbot** — A `/api/compliance/chat` endpoint that field team and office staff can query in natural language. RAG against structured compliance rules and reference documents.
2. **Project Plan Generator** — On project activation, takes the signed quote's scope and generates a critical-path task graph with inline compliance flags.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Corpus consumption model | Hybrid: deterministic rules for plan generator, vector search + LLM for chatbot | Plan generator must never hallucinate a flag; chatbot needs to handle open-ended questions |
| Plan generation trigger | On project activation (`POST /api/projects/[id]/activate`) | PM has already set scheduling context and timing; milestones exist as skeleton |
| Persistence model | Full relational: `ProjectTask`, `ComplianceFlag`, `ComplianceChatMessage` | Audit trail for compliance resolution at scale ($3-5MM 2026, scaling beyond) |
| Vector storage | In-memory at startup | Corpus is small (~20-40 rules + reference docs). Migrate to pgvector at ~1000 docs |
| Chatbot auth | NextAuth session, designed for future token-based access | Ships fast without auth complexity; API shape supports token swap later |
| Initial corpus scope | ~20-40 rules from real project experience (YAGNI) | Every flag should be actionable, not theoretical. Add rules as encountered |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  API Layer                                   │
│  POST /api/compliance/chat                   │
│  POST /api/projects/[id]/activate (extended) │
│  GET  /api/projects/[id]/plan                │
│  PATCH /api/projects/[id]/plan/tasks/[taskId]│
│  PATCH /api/compliance-flags/[id]/resolve    │
└──────────────┬──────────────────┬────────────┘
               │                  │
┌──────────────▼───────┐ ┌───────▼──────────────┐
│  Compliance Chatbot  │ │  Plan Generator      │
│  - Vector search     │ │  - Scope → tasks     │
│  - RAG w/ citations  │ │  - Critical path     │
│  - Conversation ctx  │ │  - Duration estimates │
└──────────────┬───────┘ └───────┬──────────────┘
               │                  │
         ┌─────▼──────────────────▼─────┐
         │  Rule Engine                  │
         │  - Deterministic matching     │
         │  - Keyword + condition lookup │
         │  - Severity classification    │
         └─────────────┬────────────────┘
                       │
         ┌─────────────▼────────────────┐
         │  Corpus Loader               │
         │  - Parse markdown frontmatter│
         │  - Build keyword index       │
         │  - Generate embeddings       │
         │  - Cache at startup          │
         └──────────────────────────────┘
```

---

## Compliance Corpus Structure

### File Layout

```
src/data/compliance/
├── rules/                          # Curated trigger-ready rules (~20-40)
│   ├── osha-engineering-survey.md
│   ├── osha-fall-protection.md
│   ├── ada-path-of-travel.md
│   ├── ada-changing-table.md
│   ├── nrs624-bid-limit.md
│   ├── nrs338-prevailing-wage.md
│   ├── nrs108-preliminary-lien-notice.md
│   ├── washoe-building-permit.md
│   └── ...
└── reference/                      # Broader statute text for chatbot RAG
    ├── nrs-624-full.md
    ├── nrs-338-full.md
    ├── osha-construction-standards.md
    └── washoe-permit-guide.md
```

### Rule File Format

```markdown
---
id: osha-engineering-survey
title: OSHA Engineering Survey Required Before Demolition
severity: BLOCK
citation: 29 CFR 1926.850(a)
domain: osha
triggers:
  scope_keywords: [demolition, demo, tear-out, abatement, structural removal]
  project_types: [tenant_improvement, renovation, buildout]
  conditions: []
action: Obtain engineering survey from licensed PE before any demolition work begins
---

[Human-readable explanation for chatbot context]
```

### Reference File Format

```markdown
---
id: nrs-624-full
title: NRS 624 — Contractors' Licenses
domain: nrs624
---

[Full statute text or guide content]
```

### Trigger Mechanics

- `triggers.scope_keywords` — matched against `LineItem.description` and `LineItemSection.title` (case-insensitive, word-boundary)
- `triggers.project_types` — matched against `Quote.projectType` / `Project.projectType`
- `triggers.conditions` — evaluated against project metadata:
  - `government_tenant` → any QuoteCompany with role `tenant` and type `government`
  - `contract_above_100k` → contractAmount > 100,000
  - `public_works` → project flagged as public works
  - `restroom_in_scope` → keyword match on restroom/bathroom/lavatory in scope

---

## Data Model (Prisma Schema Additions)

### ProjectTask

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| projectId | String | FK → Project |
| name | String | e.g., "Frame interior partition walls" |
| description | String? | Longer detail |
| phase | String | Groups tasks visually (e.g., "framing") |
| position | Int | Ordering within phase |
| durationDays | Int | Estimated duration |
| startDay | Int | Offset from project start (computed from deps) |
| endDay | Int | startDay + durationDays |
| isMilestoneTask | Boolean | Links to billing milestone |
| milestoneId | String? | FK → Milestone |
| isCriticalPath | Boolean | On the critical path |
| status | Enum | pending, in_progress, completed, blocked |
| completedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Self-referential many-to-many: `dependsOn: ProjectTask[]` / `blockedBy: ProjectTask[]`

### ComplianceFlag

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| projectTaskId | String | FK → ProjectTask |
| ruleId | String | Matches corpus file ID |
| severity | Enum | BLOCK, WARNING, INFO |
| title | String | Human-readable rule title |
| citation | String | e.g., "29 CFR 1926.850(a)" |
| actionItem | String | One-line action required |
| resolvedAt | DateTime? | |
| resolvedBy | String? | Who resolved it |
| resolvedNote | String? | Evidence/notes |
| createdAt | DateTime | |

### ComplianceChatMessage

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| projectId | String? | FK → Project (nullable for general questions) |
| sessionId | String | Groups conversation turns |
| role | Enum | user, assistant |
| content | String | |
| citations | Json | Array of {ruleId, citation, relevance} |
| createdAt | DateTime | |

---

## Rule Engine

**Location:** `src/lib/compliance/rule-engine.ts`

Pure functions. No LLM, no DB, no side effects.

### Matching Pipeline

1. **Keyword scan** — For each rule, check `scope_keywords` against section titles and item descriptions. Case-insensitive, word-boundary matching. Track which section/item triggered it.
2. **Project type filter** — If rule has `project_types`, project must match one. Empty = applies to all.
3. **Condition evaluation** — Special conditions resolved against project metadata (government_tenant, contract_above_100k, public_works, restroom_in_scope).
4. **Deduplication** — Same rule matching multiple scope items consolidates into one match with all matched items listed.

### Core Types

```typescript
interface ComplianceRule {
  id: string;
  title: string;
  severity: 'BLOCK' | 'WARNING' | 'INFO';
  citation: string;
  domain: string;
  triggers: {
    scope_keywords: string[];
    project_types: string[];
    conditions: string[];
  };
  action: string;
  body: string;
}

interface ProjectContext {
  projectType: string;
  scopeSections: { title: string; items: { description: string }[] }[];
  contractAmount?: number;
  companyRoles?: { type: string; role: string }[];
  siteAddress?: string;
}

interface RuleMatch {
  rule: ComplianceRule;
  matchedOn: string[];
  matchedTask?: string;
}
```

---

## Corpus Loader & Indexing

**Location:** `src/lib/compliance/corpus-loader.ts`

### Loading Flow

1. Read all `.md` files from `rules/` and `reference/`
2. Parse YAML frontmatter into structured objects
3. Build keyword index: `Map<string, string[]>` (keyword → ruleId[])
4. Generate embeddings for vector search (chatbot only)
5. Cache in module-level singleton

### Keyword Index

Inverted map for fast rule engine lookups:
```
"demolition" → ["osha-engineering-survey", "washoe-demo-permit"]
"restroom"   → ["ada-path-of-travel", "ada-changing-table"]
```

### Vector Index

- Chunk rule bodies + reference docs into ~500 token segments
- Embed via Anthropic API
- In-memory cosine similarity search
- Migrate to pgvector when corpus exceeds ~1000 documents

### Cache Strategy

- Development: reload on file change
- Production: reload on deploy (corpus is in repo)
- No runtime editing — rules go through git

---

## Plan Generator

**Location:** `src/lib/compliance/plan-generator.ts`

### Pipeline (3 Stages)

**Stage 1: Scope → Task Skeleton (deterministic)**
- Map each LineItemSection to a phase
- Generate tasks from items using `TRADE_TASK_TEMPLATES` lookup
- Assign default durations from templates
- Wire dependencies: phases sequential by default, tasks within a phase can be parallel

**Stage 2: Compliance Flag Injection (deterministic)**
- Run full scope + project context through rule engine
- Attach each RuleMatch to the most relevant task
- BLOCK flags auto-generate a predecessor task: "Resolve: [action item]" (zero duration, blocked status)

**Stage 3: Critical Path Computation (deterministic)**
- Topological sort of the task DAG
- Forward pass: earliest start/end for each task
- Backward pass: latest start/end
- Tasks where earliest == latest are on the critical path
- Total duration = max endDay across all tasks

### Output

```typescript
interface GeneratedPlan {
  tasks: {
    name: string;
    phase: string;
    position: number;
    durationDays: number;
    startDay: number;
    endDay: number;
    dependsOnPositions: number[];
    milestoneId?: string;
    isCriticalPath: boolean;
    complianceFlags: {
      ruleId: string;
      severity: string;
      title: string;
      citation: string;
      actionItem: string;
    }[];
  }[];
  totalDurationDays: number;
  criticalPath: string[];
}
```

### Integration Point

Called inside `POST /api/projects/[id]/activate` after milestones are created. Tasks and flags written in a single Prisma transaction.

### What the LLM Does NOT Do

Nothing. The plan generator is entirely lookup tables and graph algorithms. The LLM's job was done in `generateQuoteStream()` when it structured the scope.

---

## Compliance Chatbot

**Location:** `src/lib/compliance/chatbot.ts`

### RAG Pipeline (3 Steps)

**Step 1: Deterministic check**
- Run message through rule engine keyword index
- If direct rule match exists, return rule answer with exact citation
- No LLM call needed

**Step 2: Vector search fallback**
- Embed the question, search vector index
- Pull top 3-5 relevant chunks from rules/ and reference/

**Step 3: LLM synthesis**
- System prompt constrains Claude to answer ONLY from provided corpus chunks
- Must include citations to specific source sections
- If corpus doesn't contain the answer, explicitly says so
- Project context (type, scope, site address) injected when projectId provided

### System Prompt

```
You are a compliance reference assistant for a Nevada general contractor
(license #0092515, bid limit $1.4MM). Answer ONLY from the provided
reference material. If the answer is not in the provided context, say
"I don't have a reference for that — check with your compliance officer."
Never improvise compliance advice. Always cite the specific statute,
code section, or standard.
```

### Conversation History

- Last 10 messages from sessionId included for context
- Stored in ComplianceChatMessage table
- Sessions grouped by ID, no explicit open/close

---

## API Endpoints

### Modified

**`POST /api/projects/[id]/activate`**
- Extended (not replaced) to generate plan after milestones
- Response adds `plan: GeneratedPlan` field (additive, non-breaking)

### New

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/compliance/chat` | POST | NextAuth (future: token) | Chatbot query |
| `/api/projects/[id]/plan` | GET | NextAuth | Retrieve generated plan with absolute dates |
| `/api/projects/[id]/plan/tasks/[taskId]` | PATCH | NextAuth | Update task status |
| `/api/compliance-flags/[id]/resolve` | PATCH | NextAuth | Resolve a compliance flag |

### Chatbot Request/Response

```typescript
// Request
{ message: string; sessionId: string; projectId?: string }

// Response
{ reply: string; citations: { ruleId: string; citation: string; title: string }[]; severity?: 'BLOCK' | 'WARNING' | 'INFO' }
```

---

## File Layout

```
src/
├── data/compliance/
│   ├── rules/                          # ~20-40 curated trigger rules
│   └── reference/                      # Broader statute text for chatbot RAG
├── lib/compliance/
│   ├── types.ts                        # Shared types
│   ├── corpus-loader.ts                # Parse, index, embed, cache
│   ├── rule-engine.ts                  # Deterministic matching (pure functions)
│   ├── vector-search.ts               # Embedding + cosine similarity
│   ├── plan-generator.ts              # Scope → task DAG + flags
│   └── chatbot.ts                      # RAG pipeline
├── app/api/
│   ├── compliance/
│   │   └── chat/route.ts              # Chatbot endpoint
│   ├── compliance-flags/
│   │   └── [id]/
│   │       └── resolve/route.ts       # Resolve flag
│   └── projects/
│       └── [id]/
│           ├── activate/route.ts      # Extended with plan generation
│           └── plan/
│               ├── route.ts           # GET plan
│               └── tasks/
│                   └── [taskId]/route.ts  # PATCH task
```

No frontend in this spec. Dashboard views for the plan and chatbot are a separate design cycle.

---

## Constraints & Non-Goals

- **Deterministic over generative** — Rule engine is pure functions, no LLM. Plan generator uses lookup tables and graph algorithms only.
- **No runtime corpus editing** — Rules are code, they go through git.
- **No frontend** — API only. Dashboard is a separate spec.
- **No chatbot memory across sessions** — Each sessionId is independent.
- **startDay/endDay are relative offsets** — Absolute dates computed from `project.estimatedStartDate` at query time. Start date shifts don't require rewriting tasks.
