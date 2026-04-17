jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/quickbooks/client", () => ({
  qboRequest: jest.fn(),
}));

import { extractInvoiceIdsFromPayment } from "@/lib/quickbooks/payments";
import type { QboPayment } from "@/lib/quickbooks/types";

describe("extractInvoiceIdsFromPayment", () => {
  it("extracts QBO invoice IDs from payment lines", () => {
    const payment: QboPayment = {
      Id: "pay_1",
      TxnDate: "2026-04-15",
      TotalAmt: 5000,
      Line: [
        {
          LinkedTxn: [{ TxnId: "inv_100", TxnType: "Invoice" }],
          Amount: 3000,
        },
        {
          LinkedTxn: [{ TxnId: "inv_200", TxnType: "Invoice" }],
          Amount: 2000,
        },
      ],
    };

    const ids = extractInvoiceIdsFromPayment(payment);
    expect(ids).toEqual(["inv_100", "inv_200"]);
  });

  it("ignores non-Invoice linked transactions", () => {
    const payment: QboPayment = {
      Id: "pay_2",
      TxnDate: "2026-04-15",
      TotalAmt: 1000,
      Line: [
        {
          LinkedTxn: [
            { TxnId: "inv_300", TxnType: "Invoice" },
            { TxnId: "cr_1", TxnType: "CreditMemo" },
          ],
          Amount: 1000,
        },
      ],
    };

    const ids = extractInvoiceIdsFromPayment(payment);
    expect(ids).toEqual(["inv_300"]);
  });

  it("returns empty array for payment with no invoice links", () => {
    const payment: QboPayment = {
      Id: "pay_3",
      TxnDate: "2026-04-15",
      TotalAmt: 500,
      Line: [],
    };

    const ids = extractInvoiceIdsFromPayment(payment);
    expect(ids).toEqual([]);
  });
});
