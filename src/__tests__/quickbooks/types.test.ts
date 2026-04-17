import {
  type QboCustomer,
  type QboProject,
  type QboInvoice,
  type QboPayment,
  type QboWebhookPayload,
  type QboApiError,
  mapPaidMethod,
} from "@/lib/quickbooks/types";

describe("QBO types", () => {
  describe("mapPaidMethod", () => {
    it("maps Check to check", () => {
      expect(mapPaidMethod("Check")).toBe("check");
    });

    it("maps ACH variations to ach", () => {
      expect(mapPaidMethod("ACH")).toBe("ach");
      expect(mapPaidMethod("EFT")).toBe("ach");
    });

    it("maps unknown methods to other", () => {
      expect(mapPaidMethod("CreditCard")).toBe("other");
      expect(mapPaidMethod("Cash")).toBe("other");
      expect(mapPaidMethod(undefined)).toBe("other");
    });
  });
});
