jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("intuit-oauth", () => {
  return jest.fn();
});

import { buildQboUrl, parseQboError } from "@/lib/quickbooks/client";

describe("buildQboUrl", () => {
  it("builds sandbox URL", () => {
    const url = buildQboUrl("sandbox", "1234", "customer");
    expect(url).toBe(
      "https://sandbox-quickbooks.api.intuit.com/v3/company/1234/customer"
    );
  });

  it("builds production URL", () => {
    const url = buildQboUrl("production", "5678", "invoice");
    expect(url).toBe(
      "https://quickbooks.api.intuit.com/v3/company/5678/invoice"
    );
  });

  it("appends entity ID when provided", () => {
    const url = buildQboUrl("production", "5678", "customer", "99");
    expect(url).toBe(
      "https://quickbooks.api.intuit.com/v3/company/5678/customer/99"
    );
  });
});

describe("parseQboError", () => {
  it("extracts message from QBO fault response", () => {
    const body = {
      Fault: {
        Error: [
          {
            Message: "Duplicate Name",
            Detail: "Name already exists",
            code: "6240",
          },
        ],
      },
    };
    expect(parseQboError(body)).toBe("Duplicate Name: Name already exists");
  });

  it("returns fallback for unknown shape", () => {
    expect(parseQboError({})).toBe("Unknown QBO API error");
    expect(parseQboError(null)).toBe("Unknown QBO API error");
  });
});
