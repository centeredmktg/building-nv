import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/quickbooks/webhook";
import { handlePaymentUpdate } from "@/lib/quickbooks/payments";
import type { QboWebhookPayload } from "@/lib/quickbooks/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) {
    console.error("[QBO Webhook] QBO_WEBHOOK_VERIFIER_TOKEN not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("intuit-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature, verifierToken)) {
    console.error("[QBO Webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: QboWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const notification of payload.eventNotifications) {
    for (const entity of notification.dataChangeEvent.entities) {
      if (entity.name === "Payment") {
        try {
          await handlePaymentUpdate(entity.id);
        } catch (error) {
          console.error(`[QBO Webhook] Payment update failed for ${entity.id}:`, error);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
