jest.mock("@/lib/prisma", () => ({
  prisma: {
    qboConnection: { findFirst: jest.fn() },
    qboSyncRecord: { findMany: jest.fn() },
    invoice: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/quickbooks/client", () => ({
  qboRequest: jest.fn(),
}));

jest.mock("@/lib/quickbooks/customers", () => ({
  syncCustomer: jest.fn(),
}));

jest.mock("@/lib/quickbooks/projects", () => ({
  syncProject: jest.fn(),
}));

jest.mock("@/lib/quickbooks/invoices", () => ({
  syncInvoice: jest.fn(),
}));

jest.mock("@/lib/quickbooks/payments", () => ({
  handlePaymentUpdate: jest.fn(),
}));

import { shouldSync } from "@/lib/quickbooks/sync";

describe("shouldSync", () => {
  it("returns false when QBO is not configured", () => {
    const original = process.env.QBO_CLIENT_ID;
    delete process.env.QBO_CLIENT_ID;
    expect(shouldSync()).toBe(false);
    process.env.QBO_CLIENT_ID = original;
  });

  it("returns true when QBO is configured", () => {
    process.env.QBO_CLIENT_ID = "test";
    process.env.QBO_CLIENT_SECRET = "test";
    process.env.QBO_REDIRECT_URI = "http://localhost";
    expect(shouldSync()).toBe(true);
  });
});
