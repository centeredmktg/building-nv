import { generateMilestones, durationToWeeks } from "@/lib/milestone-defaults";

describe("durationToWeeks", () => {
  it("converts '3-5 days' to ~0.57 weeks", () => {
    expect(durationToWeeks("3-5 days")).toBeCloseTo(0.57, 1);
  });

  it("converts '5-7 days' to ~0.86 weeks", () => {
    expect(durationToWeeks("5-7 days")).toBeCloseTo(0.86, 1);
  });

  it("converts '1-2 days' to ~0.21 weeks", () => {
    expect(durationToWeeks("1-2 days")).toBeCloseTo(0.21, 1);
  });

  it("returns 0 for null/undefined", () => {
    expect(durationToWeeks(null)).toBe(0);
    expect(durationToWeeks(undefined)).toBe(0);
  });
});

describe("generateMilestones", () => {
  it("generates milestones for 4 scope sections with default payment split", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Paint & Drywall" },
      { title: "Flooring" },
      { title: "Ceiling" },
    ];

    const milestones = generateMilestones(sections);

    expect(milestones).toHaveLength(6);

    expect(milestones[0]).toMatchObject({
      name: "Contract Signed",
      weekNumber: 0,
      paymentPct: 10,
      paymentLabel: "Contract Signing",
      position: 0,
    });

    expect(milestones[5]).toMatchObject({
      name: "Final Walkthrough & Punch List",
      paymentPct: 5,
      paymentLabel: "Project Completion",
      position: 5,
    });

    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);

    expect(milestones[1]).toMatchObject({
      name: "Demolition",
      weekNumber: 1,
      duration: "3-5 days",
      paymentPct: 22,
      paymentLabel: "Materials Purchase",
    });
  });

  it("generates milestones for 2 scope sections", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Flooring" },
    ];

    const milestones = generateMilestones(sections);
    expect(milestones).toHaveLength(4);

    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);
  });

  it("generates milestones for 6 scope sections", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Framing" },
      { title: "Electrical" },
      { title: "Plumbing" },
      { title: "Drywall" },
      { title: "Paint & Drywall" },
    ];

    const milestones = generateMilestones(sections);
    expect(milestones).toHaveLength(8);

    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);
  });

  it("handles unknown trade names with default duration", () => {
    const sections = [{ title: "Custom Millwork" }];
    const milestones = generateMilestones(sections);
    expect(milestones[1].duration).toBe("3-5 days");
  });
});
