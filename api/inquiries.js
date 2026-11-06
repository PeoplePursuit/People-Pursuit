const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8000;
const NOTIFICATION_EMAIL = "contactus@peoplepursuit.in";
const { normalizePhoneNumber, sendInquiryConfirmation } = require("../lib/whatsapp");

function sendJson(res, status, value) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(value);
}

function validateInquiry(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Please submit a valid inquiry." };
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return { error: "Your inquiry could not be accepted." };
  }

  const fields = {
    name: 120,
    email: 254,
    service: 120,
    requirements: 3000,
    mobile: 30,
    whatsapp_phone: 30
  };
  const values = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body[field] == null ? "" : body[field];
    if (typeof value !== "string" || value.length > maxLength) {
      return { error: "Please check your inquiry details and try again." };
    }
    values[field] = value.trim();
  }

  if (!values.name || !values.email || !values.service) {
    return { error: "Please complete your name, work email, and select a service or product." };
  }
  if (!EMAIL_PATTERN.test(values.email)) {
    return { error: "Enter a valid email address." };
  }

  if (Object.prototype.hasOwnProperty.call(body, "mobile") &&
      (!values.mobile || !/^[+\d\s().-]{7,30}$/.test(values.mobile) || values.mobile.replace(/\D/g, "").length < 7)) {
    return { error: "Enter a valid mobile number." };
  }

  const whatsappConsent = body.whatsapp_consent === true ||
    body.whatsapp_consent === "on" ||
    body.whatsapp_consent === "true";
  if (whatsappConsent) {
    const whatsappPhone = normalizePhoneNumber(values.whatsapp_phone || values.mobile);
    if (!whatsappPhone) {
      return { error: "Enter a valid WhatsApp number, including its country code." };
    }
    values.whatsapp_phone = whatsappPhone;
  }
  values.whatsapp_consent = whatsappConsent;

  const meetingRequested = body.meeting_requested === true ||
    body.meeting_requested === "on" ||
    body.meeting_requested === "true";
  const preferredMeetingTime = body.preferred_meeting_time == null ? "" : body.preferred_meeting_time;
  if (typeof preferredMeetingTime !== "string" || preferredMeetingTime.length > 180) {
    return { error: "Please check your preferred meeting time and try again." };
  }
  values.preferred_meeting_time = preferredMeetingTime.trim();
  if (meetingRequested && !values.preferred_meeting_time) {
    return { error: "Please share your preferred meeting time." };
  }
  values.meeting_requested = meetingRequested;

  return { value: values };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const contentLength = Number(req.headers && req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { error: "Your inquiry is too large." });
  }

  const validation = validateInquiry(req.body);
  if (validation.error) {
    return sendJson(res, 400, { error: validation.error });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.JOB_NOTIFICATION_FROM;
  if (!apiKey || !from) {
    return sendJson(res, 503, {
      error: "The inquiry form is temporarily unavailable. Please contact us by email."
    });
  }

  const inquiry = validation.value;
  const details = [
    "A new service inquiry was submitted through the People Pursuit website.",
    "",
    "Name: " + inquiry.name,
    "Mobile: " + (inquiry.mobile || inquiry.whatsapp_phone || "Not provided"),
    "Work email: " + inquiry.email,
    "Service or product: " + inquiry.service,
    "Meeting requested: " + (inquiry.meeting_requested ? "Yes" : "No"),
    inquiry.meeting_requested ? "Preferred meeting time: " + inquiry.preferred_meeting_time : "",
    "",
    "Additional details:",
    inquiry.requirements || "None provided"
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [NOTIFICATION_EMAIL],
        reply_to: inquiry.email,
        subject: "New service inquiry from the People Pursuit website",
        text: details
      })
    });
    if (!response.ok) {
      console.error("Could not send service inquiry:", await response.text());
      return sendJson(res, 502, {
        error: "We couldn’t send your inquiry right now. Please try again later."
      });
    }
  } catch (error) {
    console.error("Service inquiry email request failed:", error);
    return sendJson(res, 502, {
      error: "We couldn’t send your inquiry right now. Please try again later."
    });
  }

  let whatsappWarning = false;
  if (inquiry.whatsapp_consent) {
    const whatsappResult = await sendInquiryConfirmation(inquiry.whatsapp_phone);
    whatsappWarning = !whatsappResult.ok;
  }

  return sendJson(res, 200, {
    message: "Your inquiry has been sent.",
    whatsappWarning
  });
};

module.exports.validateInquiry = validateInquiry;
