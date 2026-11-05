const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;

function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!accessToken || !phoneNumberId || !GRAPH_VERSION_PATTERN.test(graphVersion || "")) {
    return null;
  }

  return { accessToken, phoneNumberId, graphVersion };
}

function normalizePhoneNumber(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/[\s().-]/g, "");
  if (!PHONE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized.slice(1);
}

async function sendWhatsAppMessage(to, message, config = getWhatsAppConfig()) {
  if (!config) {
    return { ok: false, reason: "not_configured" };
  }

  let response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          ...message
        })
      }
    );
  } catch (error) {
    console.error("WhatsApp API request failed:", error);
    return { ok: false, reason: "request_failed" };
  }

  if (!response.ok) {
    console.error("WhatsApp API rejected a message with status:", response.status);
    return { ok: false, reason: "provider_rejected" };
  }

  return { ok: true };
}

async function sendInquiryConfirmation(to, config = getWhatsAppConfig()) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE;
  if (!config || !templateName || !templateLanguage) {
    return { ok: false, reason: "template_not_configured" };
  }

  return sendWhatsAppMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage }
    }
  }, config);
}

module.exports = {
  getWhatsAppConfig,
  normalizePhoneNumber,
  sendInquiryConfirmation,
  sendWhatsAppMessage
};
