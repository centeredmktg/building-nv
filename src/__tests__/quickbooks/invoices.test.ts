jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/quickbooks/client", () => ({
  qboRequest: jest.fn(),
}));

jest.mock("@/lib/quickbooks/projects", () => ({
  syncProject: jest.fn(),
}));

import { buildQboInvoicePayload } from "@/lib/quickbooks/invoices";

describe("buildQboInvoicePayload", () => {
  it("maps invoice with milestones to QBO Invoice", () => {
    const invoice = {
      invoiceNumber: "BNV-2026-0001",
      issueDate: new Date("2026-04-15"),
      dueDate: new Date("2026-05-15"),
      invoiceMilestones: [
        {
          milestone: { name: "Demolition", billingAmount: 5000 },
        },
        {
          milestone: { name: "Rough-in", billingAmount: 3000 },
        },
      ],
    };

    const payload = buildQboInvoicePayload(invoice, "qbo_cust_1", "qbo_proj_1");

    expect(payload.DocNumber).toBe("BNV-2026-0001");
    expect(payload.TxnDate).toBe("2026-04-15");
    expect(payload.DueDate).toBe("2026-05-15");
    expect(payload.CustomerRef).toEqual({ value: "qbo_cust_1" });
    expect(payload.ProjectRef).toEqual({ value: "qbo_proj_1" });
    expect(payload.Line).toHaveLength(2);
    expect(payload.Line[0]).toEqual({
      DetailType: "SalesItemLineDetail",
      Amount: 5000,
      Description: "Demolition",
      SalesItemLineDetail: { UnitPrice: 5000, Qty: 1 },
    });
    expect(payload.Line[1]).toEqual({
      DetailType: "SalesItemLineDetail",
      Amount: 3000,
      Description: "Rough-in",
      SalesItemLineDetail: { UnitPrice: 3000, Qty: 1 },
    });
  });

  it("handles invoice with no milestones using total amount", () => {
    const invoice = {
      invoiceNumber: "BNV-2026-0002",
      amount: 10000,
      issueDate: new Date("2026-04-15"),
      dueDate: new Date("2026-05-15"),
      invoiceMilestones: [],
    };

    const payload = buildQboInvoicePayload(invoice, "qbo_cust_1", "qbo_proj_1");

    expect(payload.Line).toHaveLength(1);
    expect(payload.Line[0].Amount).toBe(10000);
    expect(payload.Line[0].Description).toBe("Invoice BNV-2026-0002");
  });

  it("includes SyncToken and Id for updates", () => {
    const invoice = {
      invoiceNumber: "BNV-2026-0003",
      issueDate: new Date("2026-04-15"),
      dueDate: new Date("2026-05-15"),
      invoiceMilestones: [],
      amount: 1000,
    };

    const payload = buildQboInvoicePayload(
      invoice, "qbo_cust_1", "qbo_proj_1", "88", "5"
    );

    expect(payload.Id).toBe("88");
    expect(payload.SyncToken).toBe("5");
  });
});
