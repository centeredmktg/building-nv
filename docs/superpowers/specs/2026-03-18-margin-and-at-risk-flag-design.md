# Margin Display & At-Risk Flag

**Date:** 2026-03-18
**Status:** Approved

## Overview

Surface financial margin and milestone health on the existing Kanban pipeline. No new pages — the pipeline is the jobs board.

## Data Model

Existing fields on `Project`:
- `contractAmount: Float?` — customer price, sourced from quote totals (read-only)
- `targetCostAmount: Float?` — internal cost target (editable)
- `milestones: Milestone[]` — loaded for post-contract projects

Derived:
- `margin $` = `contractAmount - targetCostAmount`
- `margin %` = `(contractAmount - targetCostAmount) / contractAmount * 100`

At-risk condition: any milestone where `plannedDate < today` AND `completedAt === null`.

**Null/zero handling:** When either `contractAmount` or `targetCostAmount` is null, or when `contractAmount` is zero, render both margin fields as `—`.

## Types

`JobProject` (already defined in `crmTypes.ts`) extends `CRMProject` with `milestones: Milestone[]`. Components handling post-contract stages use `JobProject`. `CRMProject` is not modified.

The `KanbanBoard`, `KanbanColumn`, and `LeadCard` components accept `(CRMProject | JobProject)[]`. Post-contract cards narrow to `JobProject` when evaluating at-risk status.

## Components

### LeadCard — At-Risk Badge

- Applies only to stages: `preconstruction`, `active`, `punch_list`
- `complete` is excluded — a finished project cannot be at risk
- If at-risk condition is true, render a small amber `⚠ At Risk` badge below the project name
- Pre-contract cards and `complete` cards are unaffected

### LeadPanel — Financials Section

New section rendered for all projects:

| Field | Behavior |
|---|---|
| Customer Price | Read-only. Displays `contractAmount` or `—` |
| Target Cost | Click-to-edit. Confirm button required before saving (no blur-to-save) |
| Margin $ | Derived, read-only. Shows `—` if either input is null or `contractAmount` is zero |
| Margin % | Derived, read-only. Shows `—` if either input is null or `contractAmount` is zero |

`LeadPanel` gains an `onTargetCostUpdate(id: string, amount: number)` callback so `KanbanBoard` can keep local state in sync after a successful PATCH.

## Data Loading

`ProjectsPage` runs a single `prisma.project.findMany` with `include: { milestones: true }` for all projects. Pre-contract projects will have an empty milestones array in practice. This avoids splitting the query and propagating a complex union type through the component tree.

Result is cast to `(CRMProject | JobProject)[]` and passed to `KanbanBoard`.

## API

`PATCH /api/projects/[id]` already accepts `targetCostAmount`. No API changes needed.

## Out of Scope

- Actual cost tracking (future: summed from invoices/receipts)
- Editing `contractAmount` from the panel (sourced from quote)
- At-risk notifications or alerts
