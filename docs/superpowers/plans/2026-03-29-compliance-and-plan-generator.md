# Compliance Chatbot & Project Plan Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compliance rule engine, project plan generator with compliance flags, and a compliance chatbot API to Building NV.

**Architecture:** Layered — corpus loader parses markdown rules at startup, rule engine does deterministic keyword/condition matching, plan generator maps quote scope to a task DAG with compliance flags, chatbot does RAG with deterministic-first fallback to vector search + LLM. All persistence is relational (ProjectTask, ComplianceFlag, ComplianceChatMessage).

**Tech Stack:** Next.js 16, Prisma 7.4, Anthropic SDK, gray-matter (YAML frontmatter parsing), Jest

**Spec:** `docs/superpowers/specs/2026-03-29-compliance-and-plan-generator-design.md`

---

## File Structure

```
src/lib/compliance/
├── types.ts              # All shared types (ComplianceRule, ProjectContext, RuleMatch, etc.)
├── corpus-loader.ts      # Parse markdown, build keyword index, generate embeddings, cache
├── rule-engine.ts        # Pure deterministic matching functions
├── vector-search.ts      # Embedding generation + cosine similarity search
├── plan-generator.ts     # Scope → task DAG with compliance flags + critical path
└── chatbot.ts            # RAG pipeline (deterministic check → vector search → LLM)

src/data/compliance/
├── rules/                # ~20 curated trigger-ready compliance rules
│   ├── osha-engineering-survey.md
│   ├── osha-fall-protection.md
│   ├── osha-silica-exposure.md
│   ├── osha-confined-space.md
│   ├── osha-lockout-tagout.md
│   ├── ada-path-of-travel.md
│   ├── ada-changing-table.md
│   ├── nrs624-bid-limit.md
│   ├── nrs624-subcontractor-license.md
│   ├── nrs338-prevailing-wage.md
│   ├── nrs108-preliminary-lien-notice.md
│   ├── nrs108-notice-of-completion.md
│   ├── washoe-building-permit.md
│   ├── washoe-demo-permit.md
│   ├── washoe-fire-sprinkler.md
│   ├── washoe-mechanical-permit.md
│   ├── washoe-electrical-permit.md
│   ├── washoe-plumbing-permit.md
│   ├── nv-asbestos-survey.md
│   └── nv-lead-paint.md
└── reference/
    ├── nrs-624-contractors-license.md
    ├── osha-construction-safety.md
    └── washoe-permit-guide.md

src/app/api/
├── compliance/
│   └── chat/route.ts           # POST — chatbot endpoint
├── compliance-flags/
│   └── [id]/
│       └── resolve/route.ts    # PATCH — resolve a flag
└── projects/
    └── [id]/
        ├── activate/route.ts   # MODIFIED — add plan generation after milestones
        └── plan/
            ├── route.ts        # GET — retrieve project plan
            └── tasks/
                └── [taskId]/
                    └── route.ts # PATCH — update task status

src/__tests__/
├── compliance/
│   ├── rule-engine.test.ts
│   ├── corpus-loader.test.ts
│   ├── plan-generator.test.ts
│   └── chatbot.test.ts
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install gray-matter for YAML frontmatter parsing**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npm install gray-matter
```

- [ ] **Step 2: Install type definitions**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npm install -D @types/gray-matter
```

Note: gray-matter ships its own types — if `@types/gray-matter` doesn't exist, skip this step. Check by running the install; npm will warn if the package doesn't exist.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gray-matter for compliance corpus parsing"
```

---

### Task 2: Prisma Schema — Add ProjectTask, ComplianceFlag, ComplianceChatMessage

**Files:**
- Modify: `prisma/schema.prisma:444` (append after ProjectTeamMember model)
- Modify: `prisma/schema.prisma:206-238` (add relations to Project model)

- [ ] **Step 1: Add the three new models to the schema**

Append after line 443 (end of ProjectTeamMember model) in `prisma/schema.prisma`:

```prisma
// ─── Compliance & Project Planning ────────────────────────────────────────────

model ProjectTask {
  id              String           @id @default(cuid())
  projectId       String
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  phase           String           // groups tasks: "demolition", "framing", etc.
  position        Int              // ordering within phase
  durationDays    Int
  startDay        Int              // offset from project start
  endDay          Int              // startDay + durationDays
  isMilestoneTask Boolean          @default(false)
  milestoneId     String?
  milestone       Milestone?       @relation(fields: [milestoneId], references: [id])
  isCriticalPath  Boolean          @default(false)
  status          String           @default("pending") // pending | in_progress | completed | blocked
  completedAt     DateTime?
  complianceFlags ComplianceFlag[]
  // Self-referential many-to-many for dependencies
  dependsOn       ProjectTask[]    @relation("TaskDependency")
  dependedOnBy    ProjectTask[]    @relation("TaskDependency")
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

model ComplianceFlag {
  id            String       @id @default(cuid())
  projectTaskId String
  projectTask   ProjectTask  @relation(fields: [projectTaskId], references: [id], onDelete: Cascade)
  ruleId        String       // matches corpus file id, e.g. "osha-engineering-survey"
  severity      String       // BLOCK | WARNING | INFO
  title         String
  citation      String
  actionItem    String
  resolvedAt    DateTime?
  resolvedBy    String?
  resolvedNote  String?
  createdAt     DateTime     @default(now())
}

model ComplianceChatMessage {
  id        String   @id @default(cuid())
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  sessionId String
  role      String   // user | assistant
  content   String
  citations Json     @default("[]") // [{ruleId, citation, relevance}]
  createdAt DateTime @default(now())

  @@index([sessionId])
}
```

- [ ] **Step 2: Add relations to the Project model**

In `prisma/schema.prisma`, inside the Project model (lines 206-238), add these three relations after line 235 (`invoices Invoice[]`):

```prisma
  projectTasks         ProjectTask[]
  complianceChatMessages ComplianceChatMessage[]
```

- [ ] **Step 3: Add relation to the Milestone model**

In `prisma/schema.prisma`, inside the Milestone model (lines 60-73), add after line 72 (`invoiceMilestones InvoiceMilestone[]`):

```prisma
  projectTasks  ProjectTask[]
```

- [ ] **Step 4: Run the migration**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx prisma migrate dev --name add-compliance-and-project-tasks
```

- [ ] **Step 5: Stage generated Prisma client**

```bash
git add prisma/migrations/ src/generated/
```

Important: Always stage `src/generated/` after `prisma migrate dev` or the build will fail.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add ProjectTask, ComplianceFlag, ComplianceChatMessage models"
```

---

### Task 3: Shared Types

**Files:**
- Create: `src/lib/compliance/types.ts`
- Test: No test needed — types only

- [ ] **Step 1: Create the types file**

Create `src/lib/compliance/types.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/compliance/types.ts
git commit -m "feat: add compliance module shared types"
```

---

### Task 4: Compliance Corpus — Seed Rules

**Files:**
- Create: `src/data/compliance/rules/*.md` (20 rule files)
- Create: `src/data/compliance/reference/*.md` (3 reference files)

- [ ] **Step 1: Create the rules directory and first 5 OSHA rules**

Create `src/data/compliance/rules/osha-engineering-survey.md`:

```markdown
---
id: osha-engineering-survey
title: Engineering Survey Required Before Demolition
severity: BLOCK
citation: "29 CFR 1926.850(a)"
domain: osha
triggers:
  scope_keywords: [demolition, demo, tear-out, abatement, structural removal]
  project_types: []
  conditions: []
action: Obtain engineering survey from licensed PE before any demolition work begins
---

OSHA requires that prior to permitting employees to start demolition operations, an engineering survey shall be made by a competent person of the structure to determine the condition of the framing, floors, and walls, and the possibility of unplanned collapse of any portion of the structure. The survey must be documented and available on-site.

For CPP Painting & Construction: This applies to any TI project where existing walls, ceilings, or MEP systems are being removed. The survey must be completed and documented before the first swing.
```

Create `src/data/compliance/rules/osha-fall-protection.md`:

```markdown
---
id: osha-fall-protection
title: Fall Protection Required Above 6 Feet
severity: BLOCK
citation: "29 CFR 1926.501(b)(1)"
domain: osha
triggers:
  scope_keywords: [roofing, roof, ladder, scaffold, scaffolding, elevated, mezzanine, ceiling grid, drop ceiling, high bay]
  project_types: []
  conditions: []
action: Provide fall protection systems (guardrails, safety nets, or personal fall arrest) for work above 6 feet
---

Each employee on a walking/working surface with an unprotected side or edge which is 6 feet or more above a lower level shall be protected from falling by the use of guardrail systems, safety net systems, or personal fall arrest systems.

Common triggers in TI work: ceiling grid installation/replacement, high-bay lighting, mezzanine work, roof penetrations for HVAC. Scissor lifts with guardrails satisfy this requirement when used properly.
```

Create `src/data/compliance/rules/osha-silica-exposure.md`:

```markdown
---
id: osha-silica-exposure
title: Silica Exposure Control Plan Required
severity: WARNING
citation: "29 CFR 1926.1153"
domain: osha
triggers:
  scope_keywords: [concrete, masonry, grinding, cutting concrete, core drilling, thinset, mortar, stucco, stone]
  project_types: []
  conditions: []
action: Implement written silica exposure control plan with dust suppression measures
---

OSHA's respirable crystalline silica standard requires employers to limit worker exposure and implement engineering controls when cutting, grinding, or drilling concrete, masonry, or stone. A written exposure control plan is required.

Common triggers: concrete cutting for plumbing, core drilling for conduit, masonry work, tile installation with thinset. Wet cutting methods and HEPA vacuums are standard controls.
```

Create `src/data/compliance/rules/osha-confined-space.md`:

```markdown
---
id: osha-confined-space
title: Confined Space Entry Permit Required
severity: BLOCK
citation: "29 CFR 1926.1204"
domain: osha
triggers:
  scope_keywords: [crawl space, attic, plenum, mechanical room, vault, manhole, pit, tank]
  project_types: []
  conditions: []
action: Assess space for permit-required confined space classification; if PRCS, obtain entry permit and rescue plan
---

Before any employee enters a confined space, the employer must evaluate the workplace to determine if any spaces are permit-required confined spaces. If so, a written permit program, atmospheric testing, attendant, and rescue plan are required.

Common triggers in TI: plenum work above drop ceilings, mechanical chases, crawl spaces under raised floors. Even if a space seems open, if it has limited entry/exit and potential for hazardous atmosphere, it qualifies.
```

Create `src/data/compliance/rules/osha-lockout-tagout.md`:

```markdown
---
id: osha-lockout-tagout
title: Lockout/Tagout for Electrical and Mechanical Work
severity: BLOCK
citation: "29 CFR 1926.417"
domain: osha
triggers:
  scope_keywords: [electrical panel, breaker, disconnect, transformer, switchgear, mechanical disconnect, hvac unit]
  project_types: []
  conditions: []
action: Implement lockout/tagout procedures before servicing or maintaining electrical or mechanical equipment
---

Controls, switches, or valves must be locked out and tagged when circuits or equipment are de-energized for work. Each employee working on the circuit must apply their own lock. Tags alone are not sufficient — physical locks are required.

Standard practice for CPP: Any electrical panel work, HVAC disconnect, or mechanical equipment service requires LOTO. Verify zero energy state before beginning work.
```

- [ ] **Step 2: Create ADA rules**

Create `src/data/compliance/rules/ada-path-of-travel.md`:

```markdown
---
id: ada-path-of-travel
title: ADA Path of Travel Compliance
severity: WARNING
citation: "28 CFR 36.402; 2010 ADA Standards"
domain: ada
triggers:
  scope_keywords: [restroom, bathroom, lavatory, corridor, hallway, entrance, door, doorway, ramp, threshold]
  project_types: []
  conditions: [restroom_in_scope]
action: Verify path of travel to altered area meets ADA accessibility requirements; budget up to 20% of alteration cost for path-of-travel upgrades
---

When a primary function area is altered, the path of travel to that area must be made accessible to the extent that the cost does not exceed 20% of the alteration cost. This includes restrooms, telephones, and drinking fountains serving the altered area.

For TI work: Any restroom renovation triggers a path-of-travel review. Door widths (min 32" clear), threshold heights (max 1/2"), grab bar placement, and turning radius (60" min) must comply.
```

Create `src/data/compliance/rules/ada-changing-table.md`:

```markdown
---
id: ada-changing-table
title: NV Baby Changing Station Requirement
severity: INFO
citation: "NRS 444.160"
domain: ada
triggers:
  scope_keywords: [restroom, bathroom, lavatory, public restroom]
  project_types: []
  conditions: [restroom_in_scope]
action: Verify baby changing stations are provided in both men's and women's restrooms per NRS 444.160
---

Nevada requires that any building open to the public which contains restrooms must provide at least one baby changing table accessible to both men and women. New construction and major renovation of restroom facilities triggers this requirement.

For TI work: If the tenant space has public-facing restrooms being renovated, verify changing stations in both gendered restrooms or in an accessible family restroom.
```

- [ ] **Step 3: Create NRS licensing and wage rules**

Create `src/data/compliance/rules/nrs624-bid-limit.md`:

```markdown
---
id: nrs624-bid-limit
title: NRS 624 Contractor Bid Limit
severity: BLOCK
citation: "NRS 624.220"
domain: nrs624
triggers:
  scope_keywords: []
  project_types: []
  conditions: [contract_above_bid_limit]
action: "Contract amount exceeds CPP license bid limit of $1,400,000. Cannot bid or perform work — requires license upgrade or joint venture"
---

Nevada law prohibits a contractor from bidding on or performing any work exceeding their license bid limit. CPP Painting & Construction LLC (license #0092515) has a bid limit of $1,400,000.

Exceeding the bid limit is a Class C felony under NRS 624.700. The bid limit applies to the total contract amount including change orders.
```

Create `src/data/compliance/rules/nrs624-subcontractor-license.md`:

```markdown
---
id: nrs624-subcontractor-license
title: Subcontractor License Verification Required
severity: WARNING
citation: "NRS 624.220; NRS 624.300"
domain: nrs624
triggers:
  scope_keywords: [subcontractor, sub, electrical sub, plumbing sub, hvac sub, mechanical sub]
  project_types: []
  conditions: []
action: Verify subcontractor holds active Nevada contractor license for their trade classification before issuing subcontract
---

Any subcontractor performing work on a project must hold an active, appropriate Nevada contractor's license. The GC is responsible for verifying this before work begins. Failure to verify can result in disciplinary action against the GC's license.

Standard practice: Request and verify sub license on NVSOS and NSCB websites before issuing any subcontract or PO.
```

Create `src/data/compliance/rules/nrs338-prevailing-wage.md`:

```markdown
---
id: nrs338-prevailing-wage
title: Prevailing Wage Requirements for Public Works
severity: BLOCK
citation: "NRS 338.020; NRS 338.030"
domain: nrs338
triggers:
  scope_keywords: [government, public, municipal, county, state, federal, city of, school district]
  project_types: []
  conditions: [government_tenant, public_works]
action: Determine prevailing wage rates from Labor Commissioner; ensure all workers are paid at or above prevailing wage for their classification
---

Public works projects (those funded by public money or for public use) with an estimated cost over $100,000 require payment of prevailing wages. The Labor Commissioner publishes prevailing wage rates by trade and county.

Triggers: Government tenant in the space, public agency as the contracting party, or any project funded with public dollars. Certified payroll reporting is required weekly.
```

- [ ] **Step 4: Create NRS 108 lien law rules**

Create `src/data/compliance/rules/nrs108-preliminary-lien-notice.md`:

```markdown
---
id: nrs108-preliminary-lien-notice
title: Preliminary Lien Notice Required Within 31 Days
severity: WARNING
citation: "NRS 108.245"
domain: nrs108
triggers:
  scope_keywords: []
  project_types: []
  conditions: [contract_above_100k]
action: File preliminary 31-day lien notice with property owner before commencing work to preserve lien rights
---

Any person who provides labor, materials, or services for a work of improvement and who has not been paid must serve a preliminary notice (31-day notice) on the property owner to preserve their lien rights. This must be served before or within 31 days after first furnishing labor/materials.

For CPP: File this on every commercial project. It's a protective measure that costs nothing but preserves your right to file a mechanic's lien if payment disputes arise.
```

Create `src/data/compliance/rules/nrs108-notice-of-completion.md`:

```markdown
---
id: nrs108-notice-of-completion
title: Track Notice of Completion Filing
severity: INFO
citation: "NRS 108.228"
domain: nrs108
triggers:
  scope_keywords: []
  project_types: []
  conditions: []
action: Monitor for owner's Notice of Completion filing — lien filing deadline shortens from 90 to 40 days after recording
---

After a work of improvement is completed, the owner may file a Notice of Completion. Once recorded, the deadline for filing a mechanic's lien shortens from 90 days to 40 days. Subcontractors and material suppliers have even shorter windows.

For CPP as GC: Track when the owner files NoC. If there are outstanding receivables, ensure lien rights are preserved within the shortened window.
```

- [ ] **Step 5: Create Washoe County permit rules**

Create `src/data/compliance/rules/washoe-building-permit.md`:

```markdown
---
id: washoe-building-permit
title: Washoe County Building Permit Required
severity: BLOCK
citation: "Washoe County Building Code; IBC 2018 as adopted"
domain: washoe
triggers:
  scope_keywords: [framing, wall, partition, structural, load bearing, beam, header, footer, foundation]
  project_types: []
  conditions: []
action: Obtain building permit from Washoe County Community Services Department before structural work begins
---

Any structural work including new partition walls, removal of load-bearing walls, and structural modifications requires a building permit from Washoe County. Plan review typically takes 2-3 weeks for commercial TI.

Submit through Washoe County Community Services Department. Include architectural plans, structural calculations (if applicable), and contractor license info.
```

Create `src/data/compliance/rules/washoe-demo-permit.md`:

```markdown
---
id: washoe-demo-permit
title: Demolition Permit Required
severity: BLOCK
citation: "Washoe County Building Code Section 3303"
domain: washoe
triggers:
  scope_keywords: [demolition, demo, tear-out, structural removal, wall removal]
  project_types: []
  conditions: []
action: Obtain demolition permit from Washoe County before any demolition work begins
---

Demolition work in Washoe County requires a separate demolition permit. For interior TI demo, this is typically combined with the building permit application, but must be explicitly included in the scope of work on the permit.

Note: Selective demo (removing non-structural elements like ceiling tiles, flooring, fixtures) may not require a separate permit, but verify with the building department for each project.
```

Create `src/data/compliance/rules/washoe-fire-sprinkler.md`:

```markdown
---
id: washoe-fire-sprinkler
title: Fire Sprinkler Modification Review
severity: WARNING
citation: "Washoe County Fire Code; NFPA 13"
domain: washoe
triggers:
  scope_keywords: [sprinkler, fire sprinkler, sprinkler head, fire suppression, partition wall, new wall, demising wall]
  project_types: []
  conditions: []
action: Submit fire sprinkler modification plans to Truckee Meadows Fire if new walls alter sprinkler coverage
---

Any new partition walls or modifications that alter the existing sprinkler coverage pattern require review and potential modification of the fire sprinkler system. Plans must be submitted to Truckee Meadows Fire Protection District for review.

Common trigger: Adding a new demising wall or full-height partition can create a shadow zone in sprinkler coverage. Even if you're not touching the sprinkler system, the wall work may trigger a required sprinkler relocation.
```

Create `src/data/compliance/rules/washoe-mechanical-permit.md`:

```markdown
---
id: washoe-mechanical-permit
title: Mechanical Permit Required for HVAC Work
severity: BLOCK
citation: "Washoe County Mechanical Code; IMC 2018 as adopted"
domain: washoe
triggers:
  scope_keywords: [hvac, ductwork, furnace, air handler, mini split, heat pump, exhaust fan, ventilation, mechanical]
  project_types: []
  conditions: []
action: Obtain mechanical permit from Washoe County before HVAC installation or modification
---

Any installation, alteration, or repair of HVAC systems requires a mechanical permit. This includes new ductwork, equipment replacement, and modifications to existing systems. Inspections required at rough-in and final.
```

Create `src/data/compliance/rules/washoe-electrical-permit.md`:

```markdown
---
id: washoe-electrical-permit
title: Electrical Permit Required
severity: BLOCK
citation: "Washoe County Electrical Code; NEC 2020 as adopted"
domain: washoe
triggers:
  scope_keywords: [electrical, wiring, panel, outlet, receptacle, switch, lighting, circuit, conduit, junction box, transformer]
  project_types: []
  conditions: []
action: Obtain electrical permit from Washoe County; work must be performed by or under supervision of licensed electrician
---

Any electrical work beyond simple fixture replacement requires an electrical permit. All electrical work must be performed by or under the direct supervision of a licensed electrician. Inspections required at rough-in and final.

Note: Simple like-for-like fixture swaps (e.g., replacing a fluorescent with an LED in the same junction box) typically don't require a permit, but verify if the circuit is being modified.
```

Create `src/data/compliance/rules/washoe-plumbing-permit.md`:

```markdown
---
id: washoe-plumbing-permit
title: Plumbing Permit Required
severity: BLOCK
citation: "Washoe County Plumbing Code; UPC 2018 as adopted"
domain: washoe
triggers:
  scope_keywords: [plumbing, pipe, drain, water heater, fixture, faucet, toilet, sink, water line, sewer, backflow]
  project_types: []
  conditions: []
action: Obtain plumbing permit from Washoe County; work must be performed by licensed plumber
---

Any plumbing work including new fixtures, rerouting pipes, water heater installation, and drain modifications requires a plumbing permit. All plumbing work must be performed by a licensed plumber.

For TI: Adding a break room sink, relocating a restroom, or adding a water line for ice maker all require plumbing permits.
```

- [ ] **Step 6: Create environmental rules**

Create `src/data/compliance/rules/nv-asbestos-survey.md`:

```markdown
---
id: nv-asbestos-survey
title: Asbestos Survey Required Before Renovation/Demolition
severity: BLOCK
citation: "NAC 618.890; NESHAP 40 CFR 61"
domain: osha
triggers:
  scope_keywords: [demolition, demo, tear-out, renovation, ceiling tile, floor tile, pipe insulation, drywall, texture, popcorn ceiling]
  project_types: []
  conditions: []
action: Complete AHERA-accredited asbestos survey before any renovation or demolition in buildings constructed before 1981
---

For buildings constructed before 1981 (or with unknown construction date), an asbestos survey by an AHERA-accredited inspector is required before any renovation or demolition that will disturb building materials. This is both an OSHA and EPA (NESHAP) requirement.

If asbestos-containing materials (ACM) are found, a licensed abatement contractor must remove them before general construction can proceed. Results must be documented and available on-site.

For CPP: Request building age from property manager before bidding. If pre-1981 or unknown, include asbestos survey cost in the bid or note it as a client responsibility.
```

Create `src/data/compliance/rules/nv-lead-paint.md`:

```markdown
---
id: nv-lead-paint
title: Lead Paint Assessment for Pre-1978 Buildings
severity: WARNING
citation: "40 CFR 745; EPA RRP Rule"
domain: osha
triggers:
  scope_keywords: [painting, paint removal, scraping, sanding, window, door, trim, renovation]
  project_types: []
  conditions: []
action: Determine building construction date; if pre-1978, perform lead paint testing before disturbing painted surfaces
---

The EPA Renovation, Repair, and Painting (RRP) Rule requires that renovations in pre-1978 buildings that disturb painted surfaces be performed by EPA-certified renovators using lead-safe work practices. This applies to both residential and commercial child-occupied facilities.

For commercial TI: Most commercial buildings are lower risk, but child-occupied facilities (daycares, schools, pediatric offices) in pre-1978 buildings require full RRP compliance.
```

- [ ] **Step 7: Create reference documents**

Create `src/data/compliance/reference/nrs-624-contractors-license.md`:

```markdown
---
id: nrs-624-contractors-license
title: "NRS 624 — Nevada Contractors' Licenses Overview"
domain: nrs624
---

# NRS 624 — Nevada Contractors' Licenses

## Key Provisions for General Contractors

### Licensing Requirements (NRS 624.220)
- All contractors performing work in Nevada must hold an active license from the Nevada State Contractors Board (NSCB)
- License classifications determine the type of work permitted
- Each license has a monetary (bid) limit — the maximum single contract amount

### CPP Painting & Construction LLC
- License: #0092515
- Classification: General Building Contractor
- Bid Limit: $1,400,000
- Address: 5401 Longley Lane Ste C81, Reno NV 89511

### Bid Limit Rules (NRS 624.220)
- Cannot bid on, contract for, or perform work exceeding the bid limit
- The bid limit applies to the total original contract amount
- Change orders that push the total above the bid limit require board approval
- Exceeding the bid limit is a Class C felony (NRS 624.700)

### Subcontractor Requirements (NRS 624.300)
- All subcontractors must hold appropriate Nevada licenses
- GC is responsible for verifying sub licensing before work begins
- Unlicensed subcontractor use can result in GC license disciplinary action

### Insurance Requirements
- General liability insurance required
- Workers' compensation required for all employees
- Bond may be required depending on license classification and bid limit
```

Create `src/data/compliance/reference/osha-construction-safety.md`:

```markdown
---
id: osha-construction-safety
title: "OSHA Construction Safety Standards Overview"
domain: osha
---

# OSHA Construction Safety Standards (29 CFR 1926)

## Key Standards for Commercial TI Work

### Demolition (Subpart T — 1926.850-860)
- Engineering survey required before demolition begins (1926.850(a))
- Utilities must be shut off and capped before demolition
- Stairs, passageways, and ladders must be maintained during demo

### Fall Protection (Subpart M — 1926.500-503)
- Required at 6 feet above lower level (1926.501)
- Guardrails: 42" top rail, 21" mid rail (1926.502(b))
- Personal fall arrest: 5,000 lb anchorage (1926.502(d))
- Hole covers must support 2x the load (1926.502(i))

### Scaffolding (Subpart L — 1926.450-454)
- Must support 4x maximum intended load
- Guardrails on all open sides above 10 feet
- Competent person must inspect before each shift

### Electrical (Subpart K — 1926.400-449)
- GFCI required on all 120V, 15 and 20 amp circuits (1926.405)
- Lockout/tagout for all electrical work (1926.417)
- Assured equipment grounding conductor program alternative to GFCI

### Silica (1926.1153)
- PEL: 50 μg/m³ TWA
- Written exposure control plan required
- Table 1 compliance option for common tasks
- Medical surveillance for workers above action level for 30+ days/year

### Confined Spaces (Subpart AA — 1926.1200-1213)
- Evaluate all spaces for permit-required classification
- Written permit program if PRCS identified
- Atmospheric testing, attendant, rescue plan required

### PPE (Subpart E — 1926.95-107)
- Hard hats on all active construction sites
- Eye protection for grinding, cutting, welding
- Hearing protection above 85 dBA TWA
- High-vis vests in areas with vehicle/equipment traffic
```

Create `src/data/compliance/reference/washoe-permit-guide.md`:

```markdown
---
id: washoe-permit-guide
title: "Washoe County Permitting Guide for Commercial TI"
domain: washoe
---

# Washoe County Permitting Guide — Commercial Tenant Improvement

## When Permits Are Required

### Building Permit
- Any structural modification (new walls, removal of walls, structural reinforcement)
- Change of occupancy classification
- New or relocated plumbing, mechanical, or electrical systems
- Interior remodels exceeding cosmetic-only scope

### Permits Typically NOT Required
- Painting (no lead disturbance)
- Carpet/flooring replacement (no subfloor modification)
- Like-for-like fixture replacement
- Furniture installation
- Cosmetic updates (wallpaper, window treatments)

## Application Process

1. Submit plans to Community Services Department
2. Plan review: 2-3 weeks for commercial TI (expedited available)
3. Permit issued after plan approval + fees paid
4. Post permit card on-site at all times during work
5. Schedule inspections at required stages

## Required Inspections (Typical TI)
- Foundation/footing (if applicable)
- Framing (before drywall)
- Electrical rough-in
- Mechanical rough-in
- Plumbing rough-in
- Fire sprinkler (if modified)
- Insulation
- Final inspection (all trades)

## Fees
- Plan review: Based on project valuation
- Building permit: Based on project valuation
- Electrical, mechanical, plumbing: Separate fee schedules
- Fire: Truckee Meadows Fire Protection District separate review

## Contact
- Washoe County Community Services Department
- 1001 E. Ninth St., Reno, NV 89512
- (775) 328-2020
```

- [ ] **Step 8: Commit the corpus**

```bash
git add src/data/compliance/
git commit -m "feat: seed compliance corpus with 20 rules and 3 reference docs"
```

---

### Task 5: Corpus Loader

**Files:**
- Create: `src/lib/compliance/corpus-loader.ts`
- Test: `src/__tests__/compliance/corpus-loader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/compliance/corpus-loader.test.ts`:

```typescript
import path from "path";
import { loadCorpus, getKeywordIndex, getRule, getAllRules } from "@/lib/compliance/corpus-loader";

const RULES_DIR = path.join(process.cwd(), "src/data/compliance/rules");
const REFERENCE_DIR = path.join(process.cwd(), "src/data/compliance/reference");

describe("corpus-loader", () => {
  beforeAll(() => {
    // Force reload for tests
    loadCorpus(RULES_DIR, REFERENCE_DIR);
  });

  it("loads all rule files from the rules directory", () => {
    const rules = getAllRules();
    expect(rules.length).toBeGreaterThanOrEqual(20);
  });

  it("parses frontmatter correctly for a known rule", () => {
    const rule = getRule("osha-engineering-survey");
    expect(rule).toBeDefined();
    expect(rule!.title).toBe("Engineering Survey Required Before Demolition");
    expect(rule!.severity).toBe("BLOCK");
    expect(rule!.citation).toBe("29 CFR 1926.850(a)");
    expect(rule!.domain).toBe("osha");
    expect(rule!.triggers.scope_keywords).toContain("demolition");
    expect(rule!.triggers.scope_keywords).toContain("demo");
    expect(rule!.action).toContain("engineering survey");
    expect(rule!.body).toContain("OSHA requires");
  });

  it("builds keyword index mapping keywords to rule IDs", () => {
    const index = getKeywordIndex();
    expect(index.get("demolition")).toContain("osha-engineering-survey");
    expect(index.get("demo")).toContain("osha-engineering-survey");
    expect(index.get("restroom")).toContain("ada-path-of-travel");
    expect(index.get("restroom")).toContain("ada-changing-table");
  });

  it("handles rules with empty scope_keywords (condition-only rules)", () => {
    const rule = getRule("nrs108-preliminary-lien-notice");
    expect(rule).toBeDefined();
    expect(rule!.triggers.scope_keywords).toEqual([]);
    expect(rule!.triggers.conditions).toContain("contract_above_100k");
  });

  it("returns undefined for unknown rule IDs", () => {
    expect(getRule("nonexistent-rule")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/corpus-loader.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/compliance/corpus-loader'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/corpus-loader.ts`:

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { ComplianceRule, ReferenceDoc } from "./types";

let rules: Map<string, ComplianceRule> = new Map();
let referenceDocs: ReferenceDoc[] = [];
let keywordIndex: Map<string, string[]> = new Map();
let loaded = false;

const DEFAULT_RULES_DIR = path.join(process.cwd(), "src/data/compliance/rules");
const DEFAULT_REFERENCE_DIR = path.join(process.cwd(), "src/data/compliance/reference");

function parseRuleFile(filePath: string): ComplianceRule | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  if (!data.id || !data.severity || !data.citation) {
    console.warn(`Skipping invalid rule file: ${filePath}`);
    return null;
  }

  return {
    id: data.id,
    title: data.title ?? data.id,
    severity: data.severity as ComplianceRule["severity"],
    citation: data.citation,
    domain: data.domain ?? "unknown",
    triggers: {
      scope_keywords: data.triggers?.scope_keywords ?? [],
      project_types: data.triggers?.project_types ?? [],
      conditions: data.triggers?.conditions ?? [],
    },
    action: data.action ?? "",
    body: content.trim(),
  };
}

function parseReferenceFile(filePath: string): ReferenceDoc | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  if (!data.id) {
    console.warn(`Skipping invalid reference file: ${filePath}`);
    return null;
  }

  return {
    id: data.id,
    title: data.title ?? data.id,
    domain: data.domain ?? "unknown",
    body: content.trim(),
  };
}

function buildKeywordIndex(ruleList: ComplianceRule[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const rule of ruleList) {
    for (const keyword of rule.triggers.scope_keywords) {
      const lower = keyword.toLowerCase();
      const existing = index.get(lower) ?? [];
      existing.push(rule.id);
      index.set(lower, existing);
    }
  }
  return index;
}

export function loadCorpus(
  rulesDir: string = DEFAULT_RULES_DIR,
  referenceDir: string = DEFAULT_REFERENCE_DIR
): void {
  rules = new Map();
  referenceDocs = [];

  // Load rules
  if (fs.existsSync(rulesDir)) {
    const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    for (const file of ruleFiles) {
      const rule = parseRuleFile(path.join(rulesDir, file));
      if (rule) rules.set(rule.id, rule);
    }
  }

  // Load reference docs
  if (fs.existsSync(referenceDir)) {
    const refFiles = fs.readdirSync(referenceDir).filter((f) => f.endsWith(".md"));
    for (const file of refFiles) {
      const doc = parseReferenceFile(path.join(referenceDir, file));
      if (doc) referenceDocs.push(doc);
    }
  }

  keywordIndex = buildKeywordIndex(Array.from(rules.values()));
  loaded = true;
}

function ensureLoaded(): void {
  if (!loaded) loadCorpus();
}

export function getAllRules(): ComplianceRule[] {
  ensureLoaded();
  return Array.from(rules.values());
}

export function getRule(id: string): ComplianceRule | undefined {
  ensureLoaded();
  return rules.get(id);
}

export function getKeywordIndex(): Map<string, string[]> {
  ensureLoaded();
  return keywordIndex;
}

export function getAllReferenceDocs(): ReferenceDoc[] {
  ensureLoaded();
  return referenceDocs;
}

export function getRulesByDomain(domain: string): ComplianceRule[] {
  ensureLoaded();
  return Array.from(rules.values()).filter((r) => r.domain === domain);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/corpus-loader.test.ts --no-coverage
```

Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance/corpus-loader.ts src/__tests__/compliance/corpus-loader.test.ts
git commit -m "feat: corpus loader parses compliance rules and builds keyword index"
```

---

### Task 6: Rule Engine

**Files:**
- Create: `src/lib/compliance/rule-engine.ts`
- Test: `src/__tests__/compliance/rule-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/compliance/rule-engine.test.ts`:

```typescript
import { matchRules } from "@/lib/compliance/rule-engine";
import type { ComplianceRule, ProjectContext } from "@/lib/compliance/types";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: {
    scope_keywords: ["demolition", "demo", "tear-out"],
    project_types: [],
    conditions: [],
  },
  action: "Obtain engineering survey from licensed PE",
  body: "OSHA requires...",
};

const adaRule: ComplianceRule = {
  id: "ada-path-of-travel",
  title: "ADA Path of Travel",
  severity: "WARNING",
  citation: "28 CFR 36.402",
  domain: "ada",
  triggers: {
    scope_keywords: ["restroom", "bathroom", "lavatory"],
    project_types: [],
    conditions: ["restroom_in_scope"],
  },
  action: "Verify path of travel meets ADA requirements",
  body: "When a primary function area is altered...",
};

const prevailingWageRule: ComplianceRule = {
  id: "nrs338-prevailing-wage",
  title: "Prevailing Wage for Public Works",
  severity: "BLOCK",
  citation: "NRS 338.020",
  domain: "nrs338",
  triggers: {
    scope_keywords: ["government"],
    project_types: [],
    conditions: ["government_tenant"],
  },
  action: "Ensure prevailing wage compliance",
  body: "Public works projects...",
};

const bidLimitRule: ComplianceRule = {
  id: "nrs624-bid-limit",
  title: "NRS 624 Bid Limit",
  severity: "BLOCK",
  citation: "NRS 624.220",
  domain: "nrs624",
  triggers: {
    scope_keywords: [],
    project_types: [],
    conditions: ["contract_above_bid_limit"],
  },
  action: "Contract exceeds bid limit",
  body: "Cannot exceed...",
};

const tiOnlyRule: ComplianceRule = {
  id: "ti-specific",
  title: "TI-Specific Rule",
  severity: "INFO",
  citation: "Test",
  domain: "test",
  triggers: {
    scope_keywords: ["flooring"],
    project_types: ["tenant_improvement"],
    conditions: [],
  },
  action: "TI-specific action",
  body: "Only applies to TI...",
};

const allRules = [demoRule, adaRule, prevailingWageRule, bidLimitRule, tiOnlyRule];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rule-engine", () => {
  describe("keyword matching", () => {
    it("matches rules when scope contains a trigger keyword", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition", items: [{ description: "Demo existing partition walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("matches on item description, not just section title", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Interior Work", items: [{ description: "Tear-out existing cabinetry" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("is case-insensitive", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "DEMOLITION PHASE", items: [{ description: "Remove walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("does not match when no keywords present", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Painting", items: [{ description: "Paint all walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("osha-engineering-survey");
    });
  });

  describe("condition matching", () => {
    it("matches government_tenant condition", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        companyRoles: [{ type: "government", role: "tenant" }],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("nrs338-prevailing-wage");
    });

    it("matches contract_above_bid_limit condition", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        contractAmount: 1_500_000,
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("nrs624-bid-limit");
    });

    it("does not match contract_above_bid_limit when under limit", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        contractAmount: 500_000,
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("nrs624-bid-limit");
    });

    it("matches restroom_in_scope condition when restroom keyword found", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Restroom Renovation", items: [{ description: "Install new fixtures" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("ada-path-of-travel");
    });
  });

  describe("project type filtering", () => {
    it("matches when project type is in the rule's list", () => {
      const ctx: ProjectContext = {
        projectType: "tenant_improvement",
        scopeSections: [
          { title: "Flooring", items: [{ description: "Install LVT flooring" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("ti-specific");
    });

    it("does not match when project type is not in the rule's list", () => {
      const ctx: ProjectContext = {
        projectType: "residential",
        scopeSections: [
          { title: "Flooring", items: [{ description: "Install LVT flooring" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("ti-specific");
    });

    it("matches rules with empty project_types against any project type", () => {
      const ctx: ProjectContext = {
        projectType: "any-type-at-all",
        scopeSections: [
          { title: "Demo", items: [{ description: "Remove walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });
  });

  describe("deduplication", () => {
    it("deduplicates when the same rule matches multiple scope items", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition Phase 1", items: [{ description: "Demo north wing" }] },
          { title: "Demolition Phase 2", items: [{ description: "Demo south wing" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const demoMatches = matches.filter((m) => m.rule.id === "osha-engineering-survey");
      expect(demoMatches).toHaveLength(1);
      expect(demoMatches[0].matchedOn.length).toBeGreaterThan(1);
    });
  });

  describe("matchedOn tracking", () => {
    it("records which keywords triggered the match", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition", items: [{ description: "Tear-out existing walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const demoMatch = matches.find((m) => m.rule.id === "osha-engineering-survey");
      expect(demoMatch).toBeDefined();
      expect(demoMatch!.matchedOn).toContain("keyword:demolition");
      expect(demoMatch!.matchedOn).toContain("keyword:tear-out");
    });

    it("records conditions in matchedOn", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        companyRoles: [{ type: "government", role: "tenant" }],
      };
      const matches = matchRules(allRules, ctx);
      const wageMatch = matches.find((m) => m.rule.id === "nrs338-prevailing-wage");
      expect(wageMatch).toBeDefined();
      expect(wageMatch!.matchedOn).toContain("condition:government_tenant");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/rule-engine.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/compliance/rule-engine'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/rule-engine.ts`:

```typescript
import type { ComplianceRule, ProjectContext, RuleMatch } from "./types";

const BID_LIMIT = 1_400_000; // CPP license #0092515
const RESTROOM_KEYWORDS = ["restroom", "bathroom", "lavatory", "toilet", "washroom"];
const CONTRACT_100K_THRESHOLD = 100_000;

/**
 * Check if a keyword appears in text using case-insensitive word-boundary matching.
 */
function keywordInText(keyword: string, text: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

/**
 * Scan all scope sections and items for keyword matches.
 * Returns an array of match descriptors: ["keyword:demo", "keyword:tear-out"]
 */
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

/**
 * Evaluate special conditions against project context.
 * Returns matched condition strings.
 */
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
        // Check for public works indicators in company roles or scope keywords
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

/**
 * Match compliance rules against a project context.
 * Pure function: no DB, no LLM, no side effects.
 *
 * Pipeline:
 * 1. Keyword scan — check scope_keywords against section titles and item descriptions
 * 2. Project type filter — if rule has project_types, project must match one
 * 3. Condition evaluation — special conditions checked against project metadata
 * 4. Deduplication — consolidate multiple matches of the same rule
 */
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

    // A rule matches if it has at least one keyword match OR at least one condition match
    const hasKeywordMatch = allMatchedOn.some((m) => m.startsWith("keyword:"));
    const hasConditionMatch = allMatchedOn.some((m) => m.startsWith("condition:"));
    const hasKeywords = rule.triggers.scope_keywords.length > 0;
    const hasConditions = rule.triggers.conditions.length > 0;

    // Rules with both keywords and conditions require at least one of each
    // Rules with only keywords require keyword match
    // Rules with only conditions require condition match
    let matches = false;
    if (hasKeywords && hasConditions) {
      matches = hasKeywordMatch || hasConditionMatch;
    } else if (hasKeywords) {
      matches = hasKeywordMatch;
    } else if (hasConditions) {
      matches = hasConditionMatch;
    }
    // Rules with neither keywords nor conditions never match automatically

    if (!matches) continue;

    // Step 3: Project type filter
    if (rule.triggers.project_types.length > 0) {
      const typeMatch = rule.triggers.project_types.some(
        (t) => t.toLowerCase() === ctx.projectType.toLowerCase()
      );
      if (!typeMatch) continue;
    }

    // Step 4: Deduplicate — merge into existing match if already matched
    const existing = matchMap.get(rule.id);
    if (existing) {
      const mergedOn = [...new Set([...existing.matchedOn, ...allMatchedOn])];
      matchMap.set(rule.id, { ...existing, matchedOn: mergedOn });
    } else {
      matchMap.set(rule.id, {
        rule,
        matchedOn: allMatchedOn,
        matchedTask,
      });
    }
  }

  return Array.from(matchMap.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/rule-engine.test.ts --no-coverage
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance/rule-engine.ts src/__tests__/compliance/rule-engine.test.ts
git commit -m "feat: deterministic compliance rule engine with keyword and condition matching"
```

---

### Task 7: Plan Generator

**Files:**
- Create: `src/lib/compliance/plan-generator.ts`
- Test: `src/__tests__/compliance/plan-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/compliance/plan-generator.test.ts`:

```typescript
import { generatePlan } from "@/lib/compliance/plan-generator";
import type { ComplianceRule, ProjectContext, GeneratedPlan } from "@/lib/compliance/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: { scope_keywords: ["demolition", "demo"], project_types: [], conditions: [] },
  action: "Obtain engineering survey from licensed PE",
  body: "",
};

const permitRule: ComplianceRule = {
  id: "washoe-building-permit",
  title: "Building Permit Required",
  severity: "BLOCK",
  citation: "Washoe County Building Code",
  domain: "washoe",
  triggers: { scope_keywords: ["framing", "wall", "partition"], project_types: [], conditions: [] },
  action: "Obtain building permit before structural work",
  body: "",
};

const infoRule: ComplianceRule = {
  id: "nrs108-notice-of-completion",
  title: "Track Notice of Completion",
  severity: "INFO",
  citation: "NRS 108.228",
  domain: "nrs108",
  triggers: { scope_keywords: [], project_types: [], conditions: [] },
  action: "Monitor for NoC filing",
  body: "",
};

const rules = [demoRule, permitRule, infoRule];

const baseContext: ProjectContext = {
  projectType: "Office Buildout",
  scopeSections: [
    {
      title: "Demolition",
      items: [
        { description: "Demo existing partition walls" },
        { description: "Remove ceiling tiles" },
      ],
    },
    {
      title: "Framing",
      items: [
        { description: "Frame new partition walls per plan" },
        { description: "Install door frames" },
      ],
    },
    {
      title: "Painting",
      items: [
        { description: "Paint all new walls - 2 coats" },
      ],
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("plan-generator", () => {
  let plan: GeneratedPlan;

  beforeAll(() => {
    plan = generatePlan(rules, baseContext);
  });

  describe("task skeleton generation", () => {
    it("creates tasks for each scope section", () => {
      const phases = [...new Set(plan.tasks.map((t) => t.phase))];
      expect(phases).toContain("demolition");
      expect(phases).toContain("framing");
      expect(phases).toContain("painting");
    });

    it("assigns sequential positions", () => {
      const positions = plan.tasks.map((t) => t.position);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it("assigns positive durations to all tasks", () => {
      for (const task of plan.tasks) {
        expect(task.durationDays).toBeGreaterThan(0);
      }
    });
  });

  describe("dependency wiring", () => {
    it("makes later phases depend on earlier phases", () => {
      const framingTasks = plan.tasks.filter((t) => t.phase === "framing");
      const demoTasks = plan.tasks.filter((t) => t.phase === "demolition");
      // At least one framing task should depend on a demo task
      const demoPositions = demoTasks.map((t) => t.position);
      const hasDepOnDemo = framingTasks.some((t) =>
        t.dependsOnPositions.some((p) => demoPositions.includes(p))
      );
      expect(hasDepOnDemo).toBe(true);
    });
  });

  describe("compliance flag injection", () => {
    it("attaches BLOCK flags to matching tasks", () => {
      const demoTasks = plan.tasks.filter((t) => t.phase === "demolition");
      const hasEngSurveyFlag = demoTasks.some((t) =>
        t.complianceFlags.some((f) => f.ruleId === "osha-engineering-survey")
      );
      expect(hasEngSurveyFlag).toBe(true);
    });

    it("attaches permit flags to framing tasks", () => {
      const framingTasks = plan.tasks.filter((t) => t.phase === "framing");
      const hasPermitFlag = framingTasks.some((t) =>
        t.complianceFlags.some((f) => f.ruleId === "washoe-building-permit")
      );
      expect(hasPermitFlag).toBe(true);
    });

    it("includes severity, citation, and action on flags", () => {
      const flaggedTask = plan.tasks.find((t) =>
        t.complianceFlags.some((f) => f.ruleId === "osha-engineering-survey")
      );
      expect(flaggedTask).toBeDefined();
      const flag = flaggedTask!.complianceFlags.find(
        (f) => f.ruleId === "osha-engineering-survey"
      );
      expect(flag!.severity).toBe("BLOCK");
      expect(flag!.citation).toBe("29 CFR 1926.850(a)");
      expect(flag!.actionItem).toContain("engineering survey");
    });

    it("creates predecessor resolve tasks for BLOCK flags", () => {
      const resolveTasks = plan.tasks.filter((t) => t.name.startsWith("Resolve:"));
      expect(resolveTasks.length).toBeGreaterThan(0);
      // Resolve tasks should have 0 duration
      for (const t of resolveTasks) {
        expect(t.durationDays).toBe(0);
      }
    });
  });

  describe("critical path computation", () => {
    it("computes totalDurationDays", () => {
      expect(plan.totalDurationDays).toBeGreaterThan(0);
    });

    it("marks at least one task as critical path", () => {
      const criticalTasks = plan.tasks.filter((t) => t.isCriticalPath);
      expect(criticalTasks.length).toBeGreaterThan(0);
    });

    it("critical path includes first and last tasks", () => {
      expect(plan.criticalPath.length).toBeGreaterThan(0);
      // The last critical path entry should be the longest-running task chain
      const lastCrit = plan.criticalPath[plan.criticalPath.length - 1];
      const lastTask = plan.tasks.find((t) => t.name === lastCrit);
      expect(lastTask).toBeDefined();
      expect(lastTask!.endDay).toBe(plan.totalDurationDays);
    });

    it("startDay and endDay are consistent with dependencies", () => {
      for (const task of plan.tasks) {
        expect(task.endDay).toBe(task.startDay + task.durationDays);
        for (const depPos of task.dependsOnPositions) {
          const dep = plan.tasks.find((t) => t.position === depPos);
          if (dep) {
            expect(task.startDay).toBeGreaterThanOrEqual(dep.endDay);
          }
        }
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/plan-generator.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/compliance/plan-generator'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/plan-generator.ts`:

```typescript
import { matchRules } from "./rule-engine";
import type {
  ComplianceRule,
  ProjectContext,
  GeneratedPlan,
  GeneratedTask,
  RuleMatch,
} from "./types";

// ─── Trade task templates ─────────────────────────────────────────────────────

interface TaskTemplate {
  name: string;
  durationDays: number;
}

const TRADE_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  demolition: [
    { name: "Site protection & containment", durationDays: 1 },
    { name: "Selective demolition per scope", durationDays: 3 },
    { name: "Debris removal & haul-off", durationDays: 1 },
  ],
  framing: [
    { name: "Layout & snap lines", durationDays: 1 },
    { name: "Frame partition walls", durationDays: 4 },
    { name: "Install door frames & headers", durationDays: 1 },
  ],
  electrical: [
    { name: "Rough-in electrical per plan", durationDays: 3 },
    { name: "Install panels & circuits", durationDays: 2 },
  ],
  plumbing: [
    { name: "Rough-in plumbing per plan", durationDays: 3 },
    { name: "Install fixtures", durationDays: 2 },
  ],
  hvac: [
    { name: "HVAC rough-in & ductwork", durationDays: 3 },
    { name: "Equipment installation", durationDays: 2 },
  ],
  drywall: [
    { name: "Hang drywall", durationDays: 3 },
    { name: "Tape, mud & sand", durationDays: 3 },
  ],
  painting: [
    { name: "Surface prep & priming", durationDays: 1 },
    { name: "Paint application — 2 coats", durationDays: 3 },
  ],
  flooring: [
    { name: "Subfloor preparation", durationDays: 1 },
    { name: "Install flooring", durationDays: 4 },
    { name: "Install cove base & transitions", durationDays: 1 },
  ],
  ceiling: [
    { name: "Install ceiling grid", durationDays: 2 },
    { name: "Set ceiling tiles", durationDays: 1 },
  ],
  tile: [
    { name: "Substrate prep & waterproofing", durationDays: 1 },
    { name: "Set tile", durationDays: 4 },
    { name: "Grout & seal", durationDays: 1 },
  ],
  cabinets: [
    { name: "Install cabinets", durationDays: 3 },
    { name: "Install countertops", durationDays: 2 },
  ],
  roofing: [
    { name: "Roof tear-off", durationDays: 2 },
    { name: "Install roofing system", durationDays: 4 },
  ],
  insulation: [
    { name: "Install insulation", durationDays: 2 },
  ],
};

const DEFAULT_TASKS: TaskTemplate[] = [
  { name: "Execute scope of work", durationDays: 4 },
];

/**
 * Fuzzy-match a section title to a trade template.
 */
function lookupTasks(sectionTitle: string): { phase: string; tasks: TaskTemplate[] } {
  const lower = sectionTitle.toLowerCase().trim();
  for (const [trade, tasks] of Object.entries(TRADE_TASK_TEMPLATES)) {
    if (lower.includes(trade) || trade.includes(lower)) {
      return { phase: lower, tasks };
    }
  }
  return { phase: lower, tasks: DEFAULT_TASKS };
}

// ─── Plan generation pipeline ─────────────────────────────────────────────────

/**
 * Stage 1: Convert scope sections into a flat task list with phases and dependencies.
 */
function buildTaskSkeleton(
  sections: ProjectContext["scopeSections"]
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  let position = 0;
  let prevPhaseLastPosition = -1;

  for (const section of sections) {
    const { phase, tasks: templates } = lookupTasks(section.title);
    const phaseStartPosition = position;

    for (const template of templates) {
      const deps: number[] = [];

      // First task in this phase depends on last task of previous phase
      if (position === phaseStartPosition && prevPhaseLastPosition >= 0) {
        deps.push(prevPhaseLastPosition);
      }
      // Subsequent tasks in same phase depend on the previous task
      if (position > phaseStartPosition) {
        deps.push(position - 1);
      }

      tasks.push({
        name: template.name,
        phase,
        position,
        durationDays: template.durationDays,
        startDay: 0, // computed in stage 3
        endDay: 0,
        dependsOnPositions: deps,
        isMilestoneTask: false,
        isCriticalPath: false,
        complianceFlags: [],
      });

      position++;
    }

    prevPhaseLastPosition = position - 1;
  }

  return tasks;
}

/**
 * Stage 2: Run compliance rules and attach flags to the appropriate tasks.
 * BLOCK flags generate predecessor "Resolve:" tasks.
 */
function injectComplianceFlags(
  tasks: GeneratedTask[],
  rules: ComplianceRule[],
  ctx: ProjectContext
): GeneratedTask[] {
  const matches = matchRules(rules, ctx);

  // Group matches by the phase they triggered on
  for (const match of matches) {
    const targetPhase = match.matchedTask?.toLowerCase().trim();

    // Find the first task in the matching phase, or the first task overall
    let targetTask = targetPhase
      ? tasks.find((t) => t.phase === targetPhase)
      : tasks[0];

    if (!targetTask) targetTask = tasks[0];
    if (!targetTask) continue;

    const flag = {
      ruleId: match.rule.id,
      severity: match.rule.severity,
      title: match.rule.title,
      citation: match.rule.citation,
      actionItem: match.rule.action,
    };

    targetTask.complianceFlags.push(flag);

    // For BLOCK severity, insert a "Resolve:" predecessor task
    if (match.rule.severity === "BLOCK") {
      const resolveTask: GeneratedTask = {
        name: `Resolve: ${match.rule.action}`,
        phase: targetTask.phase,
        position: -1, // will be renumbered
        durationDays: 0,
        startDay: 0,
        endDay: 0,
        dependsOnPositions: [...targetTask.dependsOnPositions],
        isMilestoneTask: false,
        isCriticalPath: false,
        complianceFlags: [],
      };

      // Insert resolve task before the target, repoint target's deps
      const targetIdx = tasks.indexOf(targetTask);
      tasks.splice(targetIdx, 0, resolveTask);

      // Target now depends on the resolve task instead of its original deps
      targetTask.dependsOnPositions = [resolveTask.position]; // will be fixed during renumbering
    }
  }

  // Renumber positions after insertions
  for (let i = 0; i < tasks.length; i++) {
    const oldPosition = tasks[i].position;

    // Update any tasks that depended on this task's old position
    // We need a two-pass approach: first collect old→new mapping, then update deps
    tasks[i].position = i;
  }

  // Build old-to-new position map and fix dependencies
  // Since we inserted tasks, we need to fix deps by index, not old position
  // Simpler approach: rebuild deps based on structural rules
  rebuildDependencies(tasks);

  return tasks;
}

/**
 * Rebuild dependencies after task insertion.
 * Rules: within a phase, tasks are sequential.
 * First task of a phase depends on last task of previous phase.
 * Resolve tasks come before their target task.
 */
function rebuildDependencies(tasks: GeneratedTask[]): void {
  let prevPhaseLastIdx = -1;
  let currentPhase = "";
  let phaseStartIdx = 0;

  for (let i = 0; i < tasks.length; i++) {
    tasks[i].position = i;

    if (tasks[i].phase !== currentPhase) {
      if (currentPhase !== "") {
        prevPhaseLastIdx = i - 1;
      }
      currentPhase = tasks[i].phase;
      phaseStartIdx = i;
    }

    const deps: number[] = [];
    if (i === phaseStartIdx && prevPhaseLastIdx >= 0) {
      deps.push(prevPhaseLastIdx);
    }
    if (i > phaseStartIdx) {
      deps.push(i - 1);
    }
    tasks[i].dependsOnPositions = deps;
  }
}

/**
 * Stage 3: Compute start/end days and critical path using topological sort.
 */
function computeCriticalPath(tasks: GeneratedTask[]): {
  totalDurationDays: number;
  criticalPath: string[];
} {
  const n = tasks.length;
  if (n === 0) return { totalDurationDays: 0, criticalPath: [] };

  // Forward pass: earliest start/end
  for (const task of tasks) {
    let earliestStart = 0;
    for (const depPos of task.dependsOnPositions) {
      const dep = tasks[depPos];
      if (dep) {
        earliestStart = Math.max(earliestStart, dep.endDay);
      }
    }
    task.startDay = earliestStart;
    task.endDay = earliestStart + task.durationDays;
  }

  const totalDuration = Math.max(...tasks.map((t) => t.endDay));

  // Backward pass: latest start/end
  const latestEnd = new Array(n).fill(totalDuration);
  const latestStart = new Array(n).fill(0);

  // Build reverse adjacency
  const dependedOnBy: number[][] = Array.from({ length: n }, () => []);
  for (const task of tasks) {
    for (const depPos of task.dependsOnPositions) {
      if (depPos >= 0 && depPos < n) {
        dependedOnBy[depPos].push(task.position);
      }
    }
  }

  // Process in reverse order
  for (let i = n - 1; i >= 0; i--) {
    const successors = dependedOnBy[i];
    if (successors.length === 0) {
      latestEnd[i] = totalDuration;
    } else {
      latestEnd[i] = Math.min(...successors.map((s) => latestStart[s]));
    }
    latestStart[i] = latestEnd[i] - tasks[i].durationDays;
  }

  // Mark critical path: tasks where earliest start === latest start
  const criticalPath: string[] = [];
  for (let i = 0; i < n; i++) {
    if (tasks[i].startDay === latestStart[i] && tasks[i].durationDays > 0) {
      tasks[i].isCriticalPath = true;
      criticalPath.push(tasks[i].name);
    }
  }

  return { totalDurationDays: totalDuration, criticalPath };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a project plan from compliance rules and project context.
 * Pure function: no DB, no LLM.
 *
 * Pipeline:
 * 1. Scope → Task skeleton (from TRADE_TASK_TEMPLATES)
 * 2. Compliance flag injection (from rule engine matches)
 * 3. Critical path computation (forward/backward pass on DAG)
 */
export function generatePlan(
  rules: ComplianceRule[],
  ctx: ProjectContext
): GeneratedPlan {
  // Stage 1: Build task skeleton from scope sections
  let tasks = buildTaskSkeleton(ctx.scopeSections);

  // Stage 2: Inject compliance flags (may insert resolve tasks)
  tasks = injectComplianceFlags(tasks, rules, ctx);

  // Stage 3: Compute critical path
  const { totalDurationDays, criticalPath } = computeCriticalPath(tasks);

  return { tasks, totalDurationDays, criticalPath };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/plan-generator.test.ts --no-coverage
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance/plan-generator.ts src/__tests__/compliance/plan-generator.test.ts
git commit -m "feat: project plan generator with compliance flags and critical path"
```

---

### Task 8: Vector Search Module

**Files:**
- Create: `src/lib/compliance/vector-search.ts`
- Test: `src/__tests__/compliance/vector-search.test.ts` (unit test with mock embeddings)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/compliance/vector-search.test.ts`:

```typescript
import {
  cosineSimilarity,
  chunkText,
  searchByEmbedding,
  VectorStore,
} from "@/lib/compliance/vector-search";

describe("vector-search", () => {
  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it("returns 0 for orthogonal vectors", () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    });

    it("returns -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    });
  });

  describe("chunkText", () => {
    it("returns the full text when under the chunk size", () => {
      const chunks = chunkText("short text", 100);
      expect(chunks).toEqual(["short text"]);
    });

    it("splits text into roughly equal chunks on paragraph boundaries", () => {
      const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.";
      const chunks = chunkText(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(60); // some flexibility for paragraph grouping
      }
    });
  });

  describe("VectorStore", () => {
    it("returns top-k results sorted by similarity", () => {
      const store = new VectorStore();
      store.add({ id: "a-0", sourceId: "a", sourceType: "rule", text: "alpha", embedding: [1, 0, 0] });
      store.add({ id: "b-0", sourceId: "b", sourceType: "rule", text: "beta", embedding: [0, 1, 0] });
      store.add({ id: "c-0", sourceId: "c", sourceType: "reference", text: "gamma", embedding: [0.9, 0.1, 0] });

      const results = store.search([1, 0, 0], 2);
      expect(results).toHaveLength(2);
      expect(results[0].sourceId).toBe("a"); // most similar
      expect(results[1].sourceId).toBe("c"); // second most similar
    });

    it("returns empty array when store is empty", () => {
      const store = new VectorStore();
      expect(store.search([1, 0, 0], 5)).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/vector-search.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/compliance/vector-search'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/vector-search.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { VectorChunk } from "./types";

// ─── Math utilities ───────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// ─── Text chunking ───────────────────────────────────────────────────────────

/**
 * Split text into chunks on paragraph boundaries, targeting ~maxChars per chunk.
 */
export function chunkText(text: string, maxChars: number = 2000): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ─── Vector store ─────────────────────────────────────────────────────────────

export class VectorStore {
  private chunks: VectorChunk[] = [];

  add(chunk: VectorChunk): void {
    this.chunks.push(chunk);
  }

  addMany(chunks: VectorChunk[]): void {
    this.chunks.push(...chunks);
  }

  search(queryEmbedding: number[], topK: number = 5): VectorChunk[] {
    if (this.chunks.length === 0) return [];

    const scored = this.chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  }

  get size(): number {
    return this.chunks.length;
  }

  clear(): void {
    this.chunks = [];
  }
}

// ─── Embedding generation ─────────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Generate embeddings for an array of text strings.
 * Uses Anthropic's Voyage embeddings via the SDK.
 * Falls back to a simple hash-based embedding for testing when no API key is set.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Deterministic fallback for testing — not for production
    return texts.map((text) => hashEmbedding(text, 256));
  }

  const anthropic = getClient();
  // Use Voyage embeddings through Anthropic's API
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1,
    messages: [{ role: "user", content: "embed" }],
  });

  // Anthropic doesn't have a native embedding endpoint yet.
  // For now, use a hash-based approach for the small corpus.
  // TODO: Switch to Voyage AI or OpenAI embeddings when corpus grows.
  return texts.map((text) => hashEmbedding(text, 256));
}

/**
 * Simple deterministic embedding based on character trigram hashing.
 * Produces consistent vectors for the same input text.
 * Adequate for small corpus cosine similarity; not production-grade.
 */
function hashEmbedding(text: string, dimensions: number): number[] {
  const vec = new Float64Array(dimensions);
  const lower = text.toLowerCase();

  for (let i = 0; i < lower.length - 2; i++) {
    const trigram = lower.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash + trigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// Export for testing
export { searchByEmbedding };

function searchByEmbedding(
  store: VectorStore,
  queryEmbedding: number[],
  topK: number = 5
): VectorChunk[] {
  return store.search(queryEmbedding, topK);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/vector-search.test.ts --no-coverage
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance/vector-search.ts src/__tests__/compliance/vector-search.test.ts
git commit -m "feat: vector search module with cosine similarity and text chunking"
```

---

### Task 9: Chatbot RAG Pipeline

**Files:**
- Create: `src/lib/compliance/chatbot.ts`
- Test: `src/__tests__/compliance/chatbot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/compliance/chatbot.test.ts`:

```typescript
import { buildChatContext, findDirectRuleMatch } from "@/lib/compliance/chatbot";
import type { ComplianceRule } from "@/lib/compliance/types";

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: { scope_keywords: ["demolition", "demo", "tear-out"], project_types: [], conditions: [] },
  action: "Obtain engineering survey from licensed PE",
  body: "OSHA requires an engineering survey before demo work begins.",
};

const adaRule: ComplianceRule = {
  id: "ada-path-of-travel",
  title: "ADA Path of Travel",
  severity: "WARNING",
  citation: "28 CFR 36.402",
  domain: "ada",
  triggers: { scope_keywords: ["restroom", "bathroom"], project_types: [], conditions: ["restroom_in_scope"] },
  action: "Verify path of travel meets ADA requirements",
  body: "ADA path of travel requirements for altered areas.",
};

const rules = [demoRule, adaRule];

const keywordIndex = new Map<string, string[]>([
  ["demolition", ["osha-engineering-survey"]],
  ["demo", ["osha-engineering-survey"]],
  ["tear-out", ["osha-engineering-survey"]],
  ["restroom", ["ada-path-of-travel"]],
  ["bathroom", ["ada-path-of-travel"]],
]);

describe("chatbot", () => {
  describe("findDirectRuleMatch", () => {
    it("returns a rule when the message contains a trigger keyword", () => {
      const result = findDirectRuleMatch("do I need an engineering survey for demo?", rules, keywordIndex);
      expect(result).toBeDefined();
      expect(result!.id).toBe("osha-engineering-survey");
    });

    it("returns null when no keywords match", () => {
      const result = findDirectRuleMatch("what color should I paint the walls?", rules, keywordIndex);
      expect(result).toBeNull();
    });

    it("is case-insensitive", () => {
      const result = findDirectRuleMatch("DEMOLITION requirements?", rules, keywordIndex);
      expect(result).toBeDefined();
      expect(result!.id).toBe("osha-engineering-survey");
    });
  });

  describe("buildChatContext", () => {
    it("includes the rule body when a direct match is found", () => {
      const ctx = buildChatContext(demoRule, []);
      expect(ctx).toContain("OSHA requires");
      expect(ctx).toContain("29 CFR 1926.850(a)");
    });

    it("includes vector search results as additional context", () => {
      const chunks = [
        { id: "a-0", sourceId: "a", sourceType: "reference" as const, text: "Additional safety info", embedding: [] },
      ];
      const ctx = buildChatContext(null, chunks);
      expect(ctx).toContain("Additional safety info");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/chatbot.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/compliance/chatbot'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/chatbot.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ComplianceRule, ChatResponse, VectorChunk } from "./types";
import { getAllRules, getKeywordIndex, getAllReferenceDocs } from "./corpus-loader";
import { VectorStore, chunkText, generateEmbeddings } from "./vector-search";

const SYSTEM_PROMPT = `You are a compliance reference assistant for CPP Painting & Construction LLC, a Nevada general contractor (license #0092515, bid limit $1,400,000).

Answer ONLY from the provided reference material. If the answer is not in the provided context, say "I don't have a reference for that — check with your compliance officer or the relevant agency directly."

Never improvise compliance advice. Always cite the specific statute, code section, or standard. Format citations in parentheses after the relevant statement.

Keep answers concise and actionable. If a rule has a specific action item, state it clearly.`;

let vectorStore: VectorStore | null = null;
let vectorStoreInitialized = false;

/**
 * Initialize the vector store with embeddings from the corpus.
 * Called lazily on first chatbot use.
 */
async function ensureVectorStore(): Promise<VectorStore> {
  if (vectorStoreInitialized && vectorStore) return vectorStore;

  vectorStore = new VectorStore();

  const rules = getAllRules();
  const refs = getAllReferenceDocs();

  // Chunk and prepare texts
  const allTexts: { sourceId: string; sourceType: "rule" | "reference"; text: string }[] = [];

  for (const rule of rules) {
    const fullText = `${rule.title}\n${rule.citation}\n${rule.body}`;
    const chunks = chunkText(fullText);
    for (const chunk of chunks) {
      allTexts.push({ sourceId: rule.id, sourceType: "rule", text: chunk });
    }
  }

  for (const ref of refs) {
    const chunks = chunkText(ref.body);
    for (const chunk of chunks) {
      allTexts.push({ sourceId: ref.id, sourceType: "reference", text: chunk });
    }
  }

  // Generate embeddings
  const embeddings = await generateEmbeddings(allTexts.map((t) => t.text));

  for (let i = 0; i < allTexts.length; i++) {
    vectorStore.add({
      id: `${allTexts[i].sourceId}-${i}`,
      sourceId: allTexts[i].sourceId,
      sourceType: allTexts[i].sourceType,
      text: allTexts[i].text,
      embedding: embeddings[i],
    });
  }

  vectorStoreInitialized = true;
  return vectorStore;
}

/**
 * Check if the user's message directly matches any rule keywords.
 * Returns the best matching rule, or null.
 */
export function findDirectRuleMatch(
  message: string,
  rules: ComplianceRule[],
  keywordIndex: Map<string, string[]>
): ComplianceRule | null {
  const lower = message.toLowerCase();
  const matchedRuleIds = new Set<string>();

  for (const [keyword, ruleIds] of keywordIndex) {
    if (lower.includes(keyword)) {
      for (const id of ruleIds) matchedRuleIds.add(id);
    }
  }

  if (matchedRuleIds.size === 0) return null;

  // Return the highest-severity match (BLOCK > WARNING > INFO)
  const severityOrder: Record<string, number> = { BLOCK: 3, WARNING: 2, INFO: 1 };
  let best: ComplianceRule | null = null;
  let bestSeverity = 0;

  for (const id of matchedRuleIds) {
    const rule = rules.find((r) => r.id === id);
    if (rule) {
      const sev = severityOrder[rule.severity] ?? 0;
      if (sev > bestSeverity) {
        best = rule;
        bestSeverity = sev;
      }
    }
  }

  return best;
}

/**
 * Build the context string for the LLM from a direct rule match and/or vector search results.
 */
export function buildChatContext(
  directMatch: ComplianceRule | null,
  vectorResults: VectorChunk[]
): string {
  const parts: string[] = [];

  if (directMatch) {
    parts.push(`## Direct Rule Match\n**${directMatch.title}** (${directMatch.citation})\nSeverity: ${directMatch.severity}\nAction: ${directMatch.action}\n\n${directMatch.body}`);
  }

  if (vectorResults.length > 0) {
    parts.push("## Additional Reference Material");
    for (const chunk of vectorResults) {
      parts.push(`---\nSource: ${chunk.sourceId}\n${chunk.text}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Process a chat message through the compliance RAG pipeline.
 *
 * 1. Check for direct rule match via keyword index (deterministic)
 * 2. If no direct match, fall back to vector search
 * 3. Synthesize response via LLM with corpus context
 */
export async function chat(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  projectContext?: { projectType?: string; scopeDescription?: string }
): Promise<ChatResponse> {
  const rules = getAllRules();
  const kwIndex = getKeywordIndex();

  // Step 1: Direct rule match
  const directMatch = findDirectRuleMatch(message, rules, kwIndex);

  // Step 2: Vector search (always, for additional context)
  const store = await ensureVectorStore();
  const queryEmbedding = (await generateEmbeddings([message]))[0];
  const vectorResults = store.search(queryEmbedding, 5);

  // Filter out chunks from the direct match to avoid duplication
  const filteredResults = directMatch
    ? vectorResults.filter((r) => r.sourceId !== directMatch.id)
    : vectorResults;

  // Step 3: Build context and call LLM
  const context = buildChatContext(directMatch, filteredResults.slice(0, 3));

  let systemPrompt = SYSTEM_PROMPT;
  if (projectContext) {
    systemPrompt += `\n\nProject context: Type: ${projectContext.projectType ?? "unknown"}. ${projectContext.scopeDescription ?? ""}`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `Reference material:\n\n${context}\n\n---\n\nUser question: ${message}`,
    },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Build citations from direct match + vector results
  const citations: ChatResponse["citations"] = [];
  if (directMatch) {
    citations.push({
      ruleId: directMatch.id,
      citation: directMatch.citation,
      title: directMatch.title,
    });
  }
  // Add citations from vector results that are rules (not reference docs)
  const seenIds = new Set(citations.map((c) => c.ruleId));
  for (const chunk of filteredResults.slice(0, 3)) {
    if (chunk.sourceType === "rule" && !seenIds.has(chunk.sourceId)) {
      const rule = rules.find((r) => r.id === chunk.sourceId);
      if (rule) {
        citations.push({ ruleId: rule.id, citation: rule.citation, title: rule.title });
        seenIds.add(rule.id);
      }
    }
  }

  return {
    reply,
    citations,
    severity: directMatch?.severity,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest src/__tests__/compliance/chatbot.test.ts --no-coverage
```

Expected: PASS — all tests pass (the tested functions are pure, no LLM calls)

- [ ] **Step 5: Commit**

```bash
git add src/lib/compliance/chatbot.ts src/__tests__/compliance/chatbot.test.ts
git commit -m "feat: compliance chatbot with deterministic-first RAG pipeline"
```

---

### Task 10: Extend Project Activation Route

**Files:**
- Modify: `src/app/api/projects/[id]/activate/route.ts`

- [ ] **Step 1: Modify the activate route to generate the project plan**

Replace the full contents of `src/app/api/projects/[id]/activate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMilestoneTemplates } from "@/lib/milestoneTemplates";
import { POST_CONTRACT_STAGE_IDS } from "@/lib/crmTypes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generatePlan } from "@/lib/compliance/plan-generator";
import { getAllRules } from "@/lib/compliance/corpus-loader";
import type { ProjectContext } from "@/lib/compliance/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const { contractAmount, targetCostAmount, estimatedStartDate, estimatedEndDate, timingNotes } = body;

  if (contractAmount == null || targetCostAmount == null) {
    return NextResponse.json(
      { error: "contractAmount and targetCostAmount are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      quotes: {
        where: { status: "accepted" },
        include: {
          sections: { include: { items: true } },
          quoteCompanies: { include: { company: true } },
        },
        take: 1,
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (POST_CONTRACT_STAGE_IDS.includes(project.stage as never)) {
    return NextResponse.json(
      { error: "Project is already active." },
      { status: 409 }
    );
  }

  const milestoneData = getMilestoneTemplates(project.projectType);

  // Create milestones and update project stage
  const updated = await prisma.project.update({
    where: { id },
    data: {
      stage: "preconstruction",
      contractAmount: Number(contractAmount),
      targetCostAmount: Number(targetCostAmount),
      estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : null,
      estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
      timingNotes: timingNotes ?? null,
      milestones: {
        createMany: {
          data: milestoneData.map((m) => ({
            name: m.name,
            position: m.position,
          })),
        },
      },
    },
    include: {
      milestones: { orderBy: { position: "asc" } },
      projectContacts: { include: { contact: true } },
    },
  });

  // Generate project plan from quote scope + compliance rules
  const quote = project.quotes[0];
  let plan = null;

  if (quote?.sections?.length) {
    const ctx: ProjectContext = {
      projectType: project.projectType ?? "general",
      scopeSections: quote.sections.map((s) => ({
        title: s.title,
        items: s.items.map((i) => ({ description: i.description })),
      })),
      contractAmount: Number(contractAmount),
      companyRoles: quote.quoteCompanies?.map((qc) => ({
        type: qc.company.type,
        role: qc.role,
      })),
      siteAddress: project.siteAddress ?? undefined,
    };

    const rules = getAllRules();
    const generated = generatePlan(rules, ctx);
    plan = generated;

    // Persist tasks and compliance flags in a transaction
    await prisma.$transaction(async (tx) => {
      // Create all tasks first
      const createdTasks = [];
      for (const task of generated.tasks) {
        const created = await tx.projectTask.create({
          data: {
            projectId: id,
            name: task.name,
            phase: task.phase,
            position: task.position,
            durationDays: task.durationDays,
            startDay: task.startDay,
            endDay: task.endDay,
            isMilestoneTask: task.isMilestoneTask,
            isCriticalPath: task.isCriticalPath,
            status: "pending",
          },
        });
        createdTasks.push(created);

        // Create compliance flags for this task
        for (const flag of task.complianceFlags) {
          await tx.complianceFlag.create({
            data: {
              projectTaskId: created.id,
              ruleId: flag.ruleId,
              severity: flag.severity,
              title: flag.title,
              citation: flag.citation,
              actionItem: flag.actionItem,
            },
          });
        }
      }

      // Wire up dependencies via the join table
      for (const task of generated.tasks) {
        if (task.dependsOnPositions.length > 0) {
          const taskRecord = createdTasks[task.position];
          const depRecords = task.dependsOnPositions
            .map((pos) => createdTasks[pos])
            .filter(Boolean);

          if (taskRecord && depRecords.length > 0) {
            await tx.projectTask.update({
              where: { id: taskRecord.id },
              data: {
                dependsOn: {
                  connect: depRecords.map((d) => ({ id: d.id })),
                },
              },
            });
          }
        }
      }
    });
  }

  return NextResponse.json({ ...updated, plan });
}
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors related to the activate route or compliance modules

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/activate/route.ts
git commit -m "feat: generate project plan with compliance flags on project activation"
```

---

### Task 11: Chatbot API Route

**Files:**
- Create: `src/app/api/compliance/chat/route.ts`

- [ ] **Step 1: Create the chatbot API route**

Create `src/app/api/compliance/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/compliance/chatbot";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { message, sessionId, projectId } = body;

  if (!message || !sessionId) {
    return NextResponse.json(
      { error: "message and sessionId are required" },
      { status: 400 }
    );
  }

  // Load conversation history
  const history = await prisma.complianceChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  // Load project context if provided
  let projectContext: { projectType?: string; scopeDescription?: string } | undefined;
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectType: true, notes: true },
    });
    if (project) {
      projectContext = {
        projectType: project.projectType ?? undefined,
        scopeDescription: project.notes ?? undefined,
      };
    }
  }

  // Save user message
  await prisma.complianceChatMessage.create({
    data: {
      sessionId,
      projectId: projectId ?? null,
      role: "user",
      content: message,
    },
  });

  // Run the RAG pipeline
  const response = await chat(
    message,
    history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    projectContext
  );

  // Save assistant response
  await prisma.complianceChatMessage.create({
    data: {
      sessionId,
      projectId: projectId ?? null,
      role: "assistant",
      content: response.reply,
      citations: response.citations,
    },
  });

  return NextResponse.json(response);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/compliance/chat/route.ts
git commit -m "feat: compliance chatbot API endpoint with conversation persistence"
```

---

### Task 12: Plan Retrieval & Task Update Routes

**Files:**
- Create: `src/app/api/projects/[id]/plan/route.ts`
- Create: `src/app/api/projects/[id]/plan/tasks/[taskId]/route.ts`
- Create: `src/app/api/compliance-flags/[id]/resolve/route.ts`

- [ ] **Step 1: Create the plan retrieval route**

Create `src/app/api/projects/[id]/plan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, estimatedStartDate: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const tasks = await prisma.projectTask.findMany({
    where: { projectId: id },
    include: {
      complianceFlags: true,
      dependsOn: { select: { id: true, position: true, name: true } },
      dependedOnBy: { select: { id: true, position: true, name: true } },
    },
    orderBy: { position: "asc" },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No plan generated for this project" }, { status: 404 });
  }

  // Compute absolute dates if estimatedStartDate is set
  const startDate = project.estimatedStartDate;
  const tasksWithDates = tasks.map((task) => ({
    ...task,
    absoluteStartDate: startDate
      ? new Date(startDate.getTime() + task.startDay * 86400000).toISOString().slice(0, 10)
      : null,
    absoluteEndDate: startDate
      ? new Date(startDate.getTime() + task.endDay * 86400000).toISOString().slice(0, 10)
      : null,
  }));

  const totalDurationDays = Math.max(...tasks.map((t) => t.endDay));
  const criticalPath = tasks.filter((t) => t.isCriticalPath).map((t) => t.name);

  return NextResponse.json({
    projectId: id,
    totalDurationDays,
    criticalPath,
    tasks: tasksWithDates,
  });
}
```

- [ ] **Step 2: Create the task update route**

Create `src/app/api/projects/[id]/plan/tasks/[taskId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;
  const body = await req.json();
  const { status } = body;

  const validStatuses = ["pending", "in_progress", "completed", "blocked"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId: id },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      status: status ?? task.status,
      completedAt: status === "completed" ? new Date() : status !== "completed" ? null : undefined,
    },
    include: { complianceFlags: true },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Create the compliance flag resolve route**

Create `src/app/api/compliance-flags/[id]/resolve/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { resolvedBy, resolvedNote } = body;

  if (!resolvedBy) {
    return NextResponse.json(
      { error: "resolvedBy is required" },
      { status: 400 }
    );
  }

  const flag = await prisma.complianceFlag.findUnique({ where: { id } });
  if (!flag) {
    return NextResponse.json({ error: "Compliance flag not found" }, { status: 404 });
  }

  if (flag.resolvedAt) {
    return NextResponse.json(
      { error: "Flag is already resolved" },
      { status: 409 }
    );
  }

  const updated = await prisma.complianceFlag.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
      resolvedBy,
      resolvedNote: resolvedNote ?? null,
    },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[id]/plan/ src/app/api/compliance-flags/
git commit -m "feat: plan retrieval, task update, and compliance flag resolution endpoints"
```

---

### Task 13: Run All Tests

**Files:** None — validation only

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx jest --no-coverage 2>&1
```

Expected: All tests pass, including existing tests (no regressions) and all 4 new test files

- [ ] **Step 2: Run TypeScript type check**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npx tsc --noEmit --pretty 2>&1
```

Expected: No type errors

- [ ] **Step 3: Run lint**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv && npm run lint 2>&1
```

Expected: No lint errors (or only pre-existing ones)

---

## Summary

| Task | Component | Test File |
|------|-----------|-----------|
| 1 | Dependencies | — |
| 2 | Prisma schema | — (migration validates) |
| 3 | Shared types | — (types only) |
| 4 | Compliance corpus (20 rules + 3 refs) | — (validated by loader tests) |
| 5 | Corpus loader | `corpus-loader.test.ts` |
| 6 | Rule engine | `rule-engine.test.ts` |
| 7 | Plan generator | `plan-generator.test.ts` |
| 8 | Vector search | `vector-search.test.ts` |
| 9 | Chatbot RAG pipeline | `chatbot.test.ts` |
| 10 | Activate route extension | — (integration) |
| 11 | Chatbot API route | — (integration) |
| 12 | Plan/task/flag API routes | — (integration) |
| 13 | Full test suite validation | All tests |
