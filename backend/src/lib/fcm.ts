import { config } from "../config.js";
import { logger } from "./logger.js";

/**
 * Sends a push notification via FCM legacy HTTP API using the server key.
 * JWT-based (HTTP v1) is optional later; legacy keeps dependencies lean.
 */
export async function sendPushNotification(opts: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<boolean> {
  if (!config.fcmServerKey || !opts.token) {
    logger.warn("fcm: server key not configured - skipping push", { title: opts.title });
    return false;
  }

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${config.fcmServerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: opts.token,
        notification: { title: opts.title, body: opts.body },
        data: opts.data,
        priority: "high",
      }),
    });

    if (!res.ok) {
      logger.error("fcm: send failed", { status: res.status, body: await res.text() });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("fcm: send exception", { error: String(err) });
    return false;
  }
}