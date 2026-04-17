import crypto from "crypto";

/**
 * Verify QBO webhook HMAC-SHA256 signature.
 * Uses timingSafeEqual to prevent timing attacks.
 * Returns false if signature is empty or lengths differ.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  verifierToken: string
): boolean {
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac("sha256", verifierToken)
    .update(payload)
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  // timingSafeEqual throws if lengths differ — return false in that case
  if (sigBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
