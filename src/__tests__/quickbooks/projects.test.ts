jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/quickbooks/client", () => ({
  qboRequest: jest.fn(),
}));

jest.mock("@/lib/quickbooks/customers", () => ({
  syncCustomer: jest.fn(),
}));

import { buildQboProjectPayload } from "@/lib/quickbooks/projects";

describe("buildQboProjectPayload", () => {
  it("maps project fields to QBO Project", () => {
    const project = {
      id: "proj_1",
      name: "Office Buildout",
      shortCode: "OB-001",
      siteAddress: "123 Main St",
    };

    const payload = buildQboProjectPayload(project, "qbo_cust_99");

    expect(payload).toEqual({
      DisplayName: "Office Buildout",
      Description: "OB-001 — 123 Main St",
      ParentRef: { value: "qbo_cust_99" },
    });
  });

  it("handles missing shortCode and address", () => {
    const project = {
      id: "proj_2",
      name: "Quick Job",
      shortCode: null,
      siteAddress: null,
    };

    const payload = buildQboProjectPayload(project, "qbo_cust_1");

    expect(payload).toEqual({
      DisplayName: "Quick Job",
      ParentRef: { value: "qbo_cust_1" },
    });
    expect(payload.Description).toBeUndefined();
  });

  it("includes SyncToken and Id for updates", () => {
    const project = { id: "proj_3", name: "Update Job", shortCode: null, siteAddress: null };
    const payload = buildQboProjectPayload(project, "qbo_cust_1", "55", "2");

    expect(payload.Id).toBe("55");
    expect(payload.SyncToken).toBe("2");
  });
});
