import { verifyWebhookSignature } from "@/lib/quickbooks/webhook";

describe("verifyWebhookSignature", () => {
  it("returns true for valid HMAC-SHA256 signature", () => {
    const crypto = require("crypto");
    const verifierToken = "test-verifier-token";
    const payload = '{"eventNotifications":[]}';
    const expectedSig = crypto
      .createHmac("sha256", verifierToken)
      .update(payload)
      .digest("base64");

    expect(verifyWebhookSignature(payload, expectedSig, verifierToken)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    expect(verifyWebhookSignature("payload", "bad-sig", "token")).toBe(false);
  });

  it("returns false for empty signature", () => {
    expect(verifyWebhookSignature("payload", "", "token")).toBe(false);
  });
});
