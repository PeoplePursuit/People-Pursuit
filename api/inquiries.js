const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8000;
const NOTIFICATION_EMAIL = "contactus@peoplepursuit.in";

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
    requirements: 3000
  };
  const values = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body[field] == null ? "" : body[field];
    if (typeof value !== "string" || value.length > maxLength) {
      return { error: "Please check your inquiry details and try again." };
    }
    values[field] = value.trim();
  }

  if (!values.name || !values.email || !values.requirements) {
    return { error: "Please complete your name, work email, and requirements." };
  }
  if (!EMAIL_PATTERN.test(values.email)) {
    return { error: "Enter a valid email address." };
  }

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
    "Work email: " + inquiry.email,
    "Service: " + (inquiry.service || "Not specified"),
    "",
    "Requirements:",
    inquiry.requirements
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

  return sendJson(res, 200, { message: "Your inquiry has been sent." });
};

module.exports.validateInquiry = validateInquiry;
