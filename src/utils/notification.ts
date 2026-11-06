import { logger } from "./logger.js";
import { AppError } from "./appError.js";

type Channel = "EMAIL" | "SMS";

export const sendNotification = async (
  channel: Channel,
  to: string,
  message: string,
) => {
  const webhookUrl =
    channel === "EMAIL"
      ? (process.env.EMAIL_WEBHOOK_URL ?? process.env.NOTIFICATION_WEBHOOK_URL)
      : (process.env.SMS_WEBHOOK_URL ?? process.env.NOTIFICATION_WEBHOOK_URL);

  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(`${channel} delivery is not configured`, 503);
    }
    logger.warn(`[development ${channel}] to=${to}; ${message}`);
    return;
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.NOTIFICATION_WEBHOOK_TOKEN
          ? {
              authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify({ channel, to, message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(`${channel} delivery service is unavailable`, 503);
  }

  if (!response.ok) throw new AppError(`${channel} delivery failed`, 503);
};
