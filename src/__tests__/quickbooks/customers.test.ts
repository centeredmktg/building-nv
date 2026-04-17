jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/quickbooks/client", () => ({
  qboRequest: jest.fn(),
}));

import { buildQboCustomerPayload } from "@/lib/quickbooks/customers";

describe("buildQboCustomerPayload", () => {
  it("maps company fields to QBO Customer", () => {
    const company = {
      id: "comp_1",
      name: "Acme Corp",
      phone: "775-555-1234",
      domain: "acme.com",
    };
    const primaryEmail = "john@acme.com";

    const payload = buildQboCustomerPayload(company, primaryEmail);

    expect(payload).toEqual({
      DisplayName: "Acme Corp",
      CompanyName: "Acme Corp",
      PrimaryPhone: { FreeFormNumber: "775-555-1234" },
      PrimaryEmailAddr: { Address: "john@acme.com" },
      WebAddr: { URI: "acme.com" },
    });
  });

  it("omits null fields", () => {
    const company = {
      id: "comp_2",
      name: "Solo LLC",
      phone: null,
      domain: null,
    };

    const payload = buildQboCustomerPayload(company, null);

    expect(payload).toEqual({
      DisplayName: "Solo LLC",
      CompanyName: "Solo LLC",
    });
    expect(payload.PrimaryPhone).toBeUndefined();
    expect(payload.PrimaryEmailAddr).toBeUndefined();
    expect(payload.WebAddr).toBeUndefined();
  });

  it("includes SyncToken and Id for updates", () => {
    const company = { id: "comp_3", name: "Update Co", phone: null, domain: null };
    const payload = buildQboCustomerPayload(company, null, "42", "3");

    expect(payload.Id).toBe("42");
    expect(payload.SyncToken).toBe("3");
  });
});
