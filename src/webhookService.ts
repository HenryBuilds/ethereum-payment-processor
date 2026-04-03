import crypto from "crypto";
import axios from "axios";
import logger from "./logger";
import { getWebhooksByEvent } from "./database";
import { SafePayment, WebhookEvent } from "./types";

export async function sendWebhookNotifications(
  event: WebhookEvent,
  payment: SafePayment
): Promise<void> {
  const webhooks = await getWebhooksByEvent(event);

  if (webhooks.length === 0) return;

  logger.info(`Sending ${webhooks.length} webhook(s) for event: ${event}`, {
    paymentId: payment.id,
  });

  for (const webhook of webhooks) {
    try {
      const payload = JSON.stringify({
        event,
        payment,
        timestamp: new Date().toISOString(),
      });

      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(payload)
        .digest("hex");

      await axios.post(webhook.url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": event,
        },
        timeout: 10000,
      });

      logger.info("Webhook delivered", {
        webhookId: webhook.id,
        event,
        url: webhook.url,
      });
    } catch (error) {
      logger.error("Webhook delivery failed", {
        webhookId: webhook.id,
        event,
        url: webhook.url,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
