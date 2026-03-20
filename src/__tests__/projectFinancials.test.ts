import { computeMargin, isAtRisk } from "@/lib/projectFinancials";
import type { JobProject } from "@/lib/crmTypes";

describe("computeMargin", () => {
  it("returns null when contractAmount is null", () => {
    expect(computeMargin(null, 50000)).toBeNull();
  });
  it("returns null when contractAmount is zero", () => {
    expect(computeMargin(0, 50000)).toBeNull();
  });
  it("returns null when contractAmount is undefined", () => {
    expect(computeMargin(undefined, 50000)).toBeNull();
  });
  it("returns null when targetCostAmount is null", () => {
    expect(computeMargin(100000, null)).toBeNull();
  });
  it("returns null when targetCostAmount is undefined", () => {
    expect(computeMargin(100000, undefined)).toBeNull();
  });
  it("computes dollar and percent margin", () => {
    expect(computeMargin(100000, 75000)).toEqual({ dollars: 25000, percent: 25 });
  });
  it("handles negative margin", () => {
    expect(computeMargin(80000, 100000)).toEqual({ dollars: -20000, percent: -25 });
  });
  it("handles zero target cost", () => {
    expect(computeMargin(100000, 0)).toEqual({ dollars: 100000, percent: 100 });
  });
});

describe("isAtRisk", () => {
  const base: JobProject = {
    id: "1",
    name: "Test",
    stage: "active",
    projectType: null,
    message: null,
    notes: null,
    attachmentUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    estimatedCloseDate: null,
    contractAmount: null,
    targetCostAmount: null,
    estimatedStartDate: null,
    estimatedEndDate: null,
    timingNotes: null,
    projectContacts: [],
    projectCompanies: [],
    milestones: [],
  };

  const overdueMilestone = {
    id: "m1",
    projectId: "1",
    name: "Framing",
    plannedDate: "2020-01-01", // well in the past
    completedAt: null,
    position: 0,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("returns false when no milestones", () => {
    expect(isAtRisk({ ...base, stage: "active", milestones: [] })).toBe(false);
  });
  it("returns true when milestone is overdue and incomplete on active stage", () => {
    expect(isAtRisk({ ...base, stage: "active", milestones: [overdueMilestone] })).toBe(true);
  });
  it("returns true when overdue on preconstruction stage", () => {
    expect(isAtRisk({ ...base, stage: "preconstruction", milestones: [overdueMilestone] })).toBe(true);
  });
  it("returns true when overdue on punch_list stage", () => {
    expect(isAtRisk({ ...base, stage: "punch_list", milestones: [overdueMilestone] })).toBe(true);
  });
  it("returns false when overdue milestone is completed", () => {
    const completed = { ...overdueMilestone, completedAt: "2020-01-15T00:00:00.000Z" };
    expect(isAtRisk({ ...base, stage: "active", milestones: [completed] })).toBe(false);
  });
  it("returns false for complete stage even with overdue milestones", () => {
    expect(isAtRisk({ ...base, stage: "complete", milestones: [overdueMilestone] })).toBe(false);
  });
  it("returns false for pre-contract stage", () => {
    expect(isAtRisk({ ...base, stage: "opportunity_identified" as any, milestones: [overdueMilestone] })).toBe(false);
  });
  it("returns false when plannedDate is in the future", () => {
    const future = { ...overdueMilestone, plannedDate: "2099-12-31" };
    expect(isAtRisk({ ...base, stage: "active", milestones: [future] })).toBe(false);
  });
  it("returns false when milestone has null plannedDate", () => {
    const noDate = { ...overdueMilestone, plannedDate: null };
    expect(isAtRisk({ ...base, stage: "active", milestones: [noDate] })).toBe(false);
  });
});
