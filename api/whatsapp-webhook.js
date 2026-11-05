const { createHmac, timingSafeEqual } = require("node:crypto");
const whatsapp = require("../lib/whatsapp");

const INBOUND_REPLY =
  "Thanks for messaging People Pursuit. We’ve received your message and will get back to you soon.";
const MAX_BODY_BYTES = 64 * 1024;

function textResponse(res, status, value) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).send(value);
}

function isEqualSecret(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidSignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) {
    return false;
  }
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return isEqualSecret(signature, expected);
}

function extractIncomingMessages(payload, phoneNumberId) {
  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return [];
  }

  const messages = [];
  for (const entry of payload.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change.value;
      if (!value || value.metadata?.phone_number_id !== phoneNumberId || !Array.isArray(value.messages)) {
        continue;
      }
      for (const message of value.messages) {
        if (typeof message?.from === "string" && /^\d{8,15}$/.test(message.from)) {
          messages.push(message.from);
        }
      }
    }
  }
  return messages;
}

async function handler(req, res) {
  const url = new URL(req.url, "https://webhook.local");

  if (req.method === "GET") {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      verifyToken &&
      isEqualSecret(url.searchParams.get("hub.verify_token"), verifyToken)
    ) {
      return textResponse(res, 200, url.searchParams.get("hub.challenge") || "");
    }
    return textResponse(res, 403, "Webhook verification failed.");
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).end();
  }

  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return textResponse(res, 413, "Request too large.");
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const config = whatsapp.getWhatsAppConfig();
  if (!appSecret || !config) {
    return textResponse(res, 503, "WhatsApp webhook is not configured.");
  }

  const chunks = [];
  let bodySize = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodySize += buffer.length;
    if (bodySize > MAX_BODY_BYTES) {
      return textResponse(res, 413, "Request too large.");
    }
    chunks.push(buffer);
  }
  const rawBody = Buffer.concat(chunks, bodySize);
  if (rawBody.length > MAX_BODY_BYTES) {
    return textResponse(res, 413, "Request too large.");
  }
  if (!isValidSignature(rawBody, req.headers["x-hub-signature-256"], appSecret)) {
    return textResponse(res, 401, "Invalid webhook signature.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return textResponse(res, 400, "Invalid JSON.");
  }

  const senders = extractIncomingMessages(payload, config.phoneNumberId);
  for (const sender of senders) {
    const result = await whatsapp.sendWhatsAppMessage(sender, {
      type: "text",
      text: { body: INBOUND_REPLY }
    }, config);
    if (!result.ok) {
      return textResponse(res, 502, "Could not send the WhatsApp reply.");
    }
  }

  return textResponse(res, 200, "EVENT_RECEIVED");
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
module.exports.extractIncomingMessages = extractIncomingMessages;
module.exports.isValidSignature = isValidSignature;
