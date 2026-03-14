import {
  getComplianceStatus,
  isOnboardingComplete,
  formatEmployeeName,
} from "@/lib/employees";

describe("getComplianceStatus", () => {
  const baseCert = {
    id: "c1",
    type: "OSHA_10",
    issueDate: new Date("2023-01-01"),
    expirationDate: null,
    cardPhotoUrl: "https://example.com/card.jpg",
    verifiedStatus: "verified",
  };

  it("returns verified when OSHA_10 cert has photo", () => {
    expect(getComplianceStatus([baseCert])).toBe("verified");
  });

  it("returns unverified when OSHA_10 cert has no photo", () => {
    const cert = { ...baseCert, cardPhotoUrl: null, verifiedStatus: "unverified" };
    expect(getComplianceStatus([cert])).toBe("unverified");
  });

  it("returns no_cert when no OSHA certifications", () => {
    expect(getComplianceStatus([])).toBe("no_cert");
  });

  it("returns expired when cert expirationDate is in the past", () => {
    const cert = { ...baseCert, expirationDate: new Date("2020-01-01") };
    expect(getComplianceStatus([cert])).toBe("expired");
  });

  it("returns expiring_soon when cert expires within 30 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    const cert = { ...baseCert, expirationDate: soon };
    expect(getComplianceStatus([cert])).toBe("expiring_soon");
  });
});

describe("isOnboardingComplete", () => {
  const allSteps = [
    "personal_info", "emergency_contacts", "employment_docs",
    "gusto_setup", "osha_certification", "safety_manual_ack",
    "workbook_ack", "complete",
  ].map((stepName) => ({ stepName, completedAt: new Date() }));

  it("returns true when all steps completed", () => {
    expect(isOnboardingComplete(allSteps)).toBe(true);
  });

  it("returns false when any step is missing", () => {
    const partial = allSteps.filter((s) => s.stepName !== "safety_manual_ack");
    expect(isOnboardingComplete(partial)).toBe(false);
  });

  it("returns false when a step has no completedAt", () => {
    const incomplete = allSteps.map((s) =>
      s.stepName === "workbook_ack" ? { ...s, completedAt: null } : s
    );
    expect(isOnboardingComplete(incomplete)).toBe(false);
  });
});

describe("formatEmployeeName", () => {
  it("returns legalName when present", () => {
    expect(formatEmployeeName({ legalName: "John Smith", firstName: "John", lastName: "Smith" }))
      .toBe("John Smith");
  });

  it("falls back to firstName + lastName when no legalName", () => {
    expect(formatEmployeeName({ legalName: null, firstName: "John", lastName: "Smith" }))
      .toBe("John Smith");
  });
});
