# Subcontractor Bid Request Engine — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Phase:** V1 (capacity stub, manual notifications)

---

## Overview

A subcontractor management and bid request generation system for Building NV. The engine manages subcontractor profiles, generates obscured bid requests from quote sections, tracks bids and awards, and provides a structured performance review system. It includes a recommendation engine that evaluates whether work should be done in-house or subbed out based on trade/license requirements (V1) with a designed-in stub for crew capacity awareness (future phase).

---

## Data Model

### Trade Enum (Shared)

Unified trade classification used across SubcontractorProfile, InHouseCapability, LineItem, and Employee:

```
general_labor | carpentry | electrical | plumbing | hvac | painting | concrete |
roofing | flooring | drywall | insulation | demolition | excavation | landscaping |
fire_protection | low_voltage | glazing | masonry | welding | other
```

Replaces Employee.tradeClassification values: `laborer` → `general_labor`, `carpenter` → `carpentry`, `electrician` → `electrical`. Role-based values (`superintendent`, `pm`) are not trades — they're already handled by the Contact/Employee type system and are removed from the trade enum.

### Company Type Extension

Add `subcontractor` to the Company.type enum:

```
customer | vendor | pm | subcontractor | other
```

### SubcontractorProfile (new, 1:1 with Company)

Mirrors the Employee ↔ Contact pattern. Only exists when Company.type = "subcontractor".

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| companyId | String (unique) | FK → Company |
| trades | Trade[] | Array of trade classifications the sub performs |
| licenseNumber | String? | NV contractor license number |
| bidLimit | Float? | Bonding/bid limit in dollars |
| onboardingStatus | Enum | `pending \| documents_requested \| under_review \| approved \| suspended` |
| insuranceExpiry | DateTime? | Certificate of insurance expiration |
| w9OnFile | Boolean | Default false |
| notes | String? | Internal notes |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ContactNote (new, per-person flags on sub contacts)

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| contactId | String | FK → Contact |
| companyId | String | FK → Company (the sub firm) |
| preferred | Boolean | "Request this person" flag |
| flagged | Boolean | "Avoid if possible" flag |
| notes | String? | Free text context |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint on (contactId, companyId) — one note per person per firm.

### SubcontractorReview (new)

Created during project closeout by the foreman/supervisor. One per sub per project.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| subcontractorId | String | FK → Company |
| projectId | String | FK → Project |
| reviewerId | String | FK → Contact (foreman/supervisor) |
| timeliness | Int | 1-5 rating |
| communication | Int | 1-5 rating |
| price | Int | 1-5 rating |
| qualityOfWork | Int | 1-5 rating |
| wouldRehire | Boolean | The gut-check boolean |
| notes | String? | Free text |
| createdAt | DateTime | |

Unique constraint on (subcontractorId, projectId) — one review per sub per project.

Company-level scores are always computed as rolling aggregates from reviews. No denormalized score field.

### InHouseCapability (new)

Lightweight config defining what the company can perform in-house.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| trade | Trade (unique) | Trade classification |
| canPerform | Boolean | Do we hold the license/capability |
| capacityCheckAvailable | Boolean | Default false (V1 stub) |

### LineItem Extension

Add optional trade field:

| Field | Type | Description |
|-------|------|-------------|
| trade | Trade? | Trade classification for this line item |

### LineItemSection Extension

Add optional trade field as section-level default:

| Field | Type | Description |
|-------|------|-------------|
| trade | Trade? | Default trade for items in this section |

**Inheritance:** If a line item has no trade set, it inherits from its section. If neither has a trade, the recommendation engine skips it.

### BidRequest (new)

Generated from selected quote line items with client details obscured.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| quoteId | String | FK → Quote (internal, never exposed to subs) |
| projectType | String | From quote (e.g., "commercial interior") |
| generalLocation | String | City/region only (e.g., "Reno, NV") |
| scopeOfWork | String | Generated from selected line items — descriptions and quantities only, no pricing |
| requiredTrade | Trade | Trade classification for this bid |
| responseDeadline | DateTime | When bids are due |
| startWindow | String | Estimated start timeframe (e.g., "Mid-April 2026") |
| specialRequirements | String? | Permits, site access, insurance minimums |
| status | Enum | `draft \| sent \| responses_received \| awarded \| cancelled` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### BidInvitation (new, junction)

Tracks which subcontractors received a bid request.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| bidRequestId | String | FK → BidRequest |
| subcontractorId | String | FK → Company |
| sentAt | DateTime? | When the invitation was sent |
| status | Enum | `pending \| viewed \| responded \| declined` |

Unique constraint on (bidRequestId, subcontractorId).

### BidResponse (new)

What comes back from subcontractors.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| bidInvitationId | String (unique) | FK → BidInvitation |
| amount | Float | Their bid price |
| scopeNotes | String? | Clarifications or exclusions |
| estimatedDuration | String? | Their timeline estimate |
| availableStartDate | DateTime? | When they can start |
| receivedAt | DateTime | |
| status | Enum | `submitted \| under_review \| accepted \| rejected` |

---

## Recommendation Engine

### V1 Behavior

Evaluates line items against InHouseCapability config:

- **`in_house`** — trade is `canPerform: true`, capacity check unavailable
- **`sub_out`** — trade is `canPerform: false` or not in config
- **`consider_sub`** — reserved for future capacity-aware recommendations (not triggered in V1)

Returns per line item/section:
```
{ trade: "electrical", recommendation: "sub_out", reason: "No in-house license" }
{ trade: "painting", recommendation: "in_house", reason: "Licensed, capacity check unavailable" }
```

### Future Capacity Integration (Stub)

When `capacityCheckAvailable` flips to true for a trade, the engine reads across active ProjectTeamMember assignments and ProjectTask timelines to determine crew availability. A trade where `canPerform: true` but crews are fully committed within the project timeline returns `consider_sub` with a reason like "Licensed but crews committed through April 15."

No capacity logic is implemented in V1 — the interface and recommendation states are designed to accommodate it without rearchitecting.

---

## Bid Request Generation Flow

1. User opens a quote → system shows trade-based recommendations on each section/line item
2. User selects line items to include in a bid request (can follow or override recommendations)
3. System generates a BidRequest with obscured details:
   - **Included:** project type, general location (city/region), scope descriptions with quantities, required trade, timeline, special requirements
   - **Stripped:** client name, exact address, all pricing (unitPrice, vendorCost, markups)
4. User selects which subcontractors receive the bid request (BidInvitation records created)

### Subcontractor Selection Screen

For each sub matching the required trade, display:
- Company name, license number, bid limit
- Onboarding status (approved / pending / suspended)
- Scorecard: jobs completed, average ratings across dimensions, would-rehire percentage
- Last job date
- Flagged/preferred contacts at the firm
- Past bid history and win rate

**Default sort:** Approved subs first, then by composite score.
**Filters:** Onboarding status, minimum score threshold, bid limit (must exceed estimated scope value).
**Suspended subs:** Visible but greyed out with reason shown.

### Award Flow

1. User reviews bid responses side-by-side
2. Marks one as `accepted` → others become `rejected`
3. System optionally links sub to Project via ProjectCompany (role: "subcontractor")
4. Awarded amount stored for margin tracking (quote price to client vs. sub cost)

---

## Performance Review System

### Trigger

Part of standard project closeout. When a sub's scope on a project is complete, the foreman/supervisor creates a SubcontractorReview.

### Dimensions

- **Timeliness** (1-5): Did they meet their schedule commitments?
- **Communication** (1-5): Were they responsive and proactive?
- **Price** (1-5): Was the final cost reasonable relative to the bid?
- **Quality of Work** (1-5): Did the work meet standards?
- **Would Rehire** (boolean): The judgment call that numbers don't capture

### Aggregation

Company-level scores computed on read as rolling averages across all reviews. No denormalized score fields.

---

## Pricing Intelligence (Passive)

When bid responses come in, the system can compare sub pricing against internal estimates (vendorCost on line items). Over time this builds a market pricing dataset per trade and scope type. No dedicated analytics UI in V1 — the data accumulates and can be queried later.

---

## Phase 2 (Out of Scope for V1)

- **Email notifications via Resend:** Automated bid request delivery to subs, award/rejection notifications, deadline reminders
- **Crew capacity planning:** Read across active ProjectTeamMember and ProjectTask to determine crew availability per trade
- **Pricing analytics dashboard:** Market rate trends, margin analysis by trade
- **Sub portal:** Self-service for subs to view invitations, submit bids, upload documents

---

## Migration Notes

- Employee.tradeClassification enum values migrate: `laborer` → `general_labor`, `carpenter` → `carpentry`, `electrician` → `electrical`. Values `superintendent` and `pm` are roles, not trades — existing employees with those values get migrated to `other` and their role is already captured via Contact.type / ProjectTeamMember. The `superintendent` and `pm` values are removed from the trade enum.
- Company.type enum gets `subcontractor` added.
- LineItem and LineItemSection get optional `trade` field — non-breaking, existing records unaffected.
- InHouseCapability seeded with initial config based on CPP Painting & Construction's NV license.
