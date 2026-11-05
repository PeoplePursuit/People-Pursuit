const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { afterEach, test } = require("node:test");
const { Readable } = require("node:stream");
const inquiriesApi = require("../api/inquiries");
const whatsappWebhook = require("../api/whatsapp-webhook");
const whatsapp = require("../lib/whatsapp");

const originalFetch = global.fetch;
const envNames = [
  "RESEND_API_KEY",
  "JOB_NOTIFICATION_FROM",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_GRAPH_API_VERSION",
  "WHATSAPP_TEMPLATE_NAME",
  "WHATSAPP_TEMPLATE_LANGUAGE",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
function configureWhatsApp() {
  process.env.RESEND_API_KEY = "server-only-resend-test-key";
  process.env.JOB_NOTIFICATION_FROM = "People Pursuit <jobs@example.com>";
  process.env.WHATSAPP_ACCESS_TOKEN = "server-only-whatsapp-test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v99.0";
  process.env.WHATSAPP_TEMPLATE_NAME = "website_inquiry_confirmation";
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = "en_US";
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
}

function createMockResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

function validInquiry(overrides = {}) {
  return {
    name: "Alex Candidate",
    email: "alex@example.com",
    service: "Permanent Staffing",
    requirements: "We need help hiring a senior engineer.",
    website: "",
    ...overrides
  };
}

function mockEmailAndWhatsApp() {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === "https://api.resend.com/emails") {
      return { ok: true, async text() { return ""; } };
    }
    return { ok: true, status: 200 };
  };
  return calls;
}

function signedWebhookRequest(payload) {
  const body = JSON.stringify(payload);
  const signature = "sha256=" +
    createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(body).digest("hex");
  return { body, signature };
}

function createWebhookRequest(method, url, body, signature) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = signature ? { "x-hub-signature-256": signature } : {};
  return req;
}

function createWebhookResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    end() {
      return this;
    }
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("normalizes WhatsApp numbers with country codes and rejects local-only numbers", () => {
  assert.equal(whatsapp.normalizePhoneNumber("+919876543210"), "919876543210");
  assert.equal(whatsapp.normalizePhoneNumber("+91 98765-43210"), "919876543210");
  assert.equal(whatsapp.normalizePhoneNumber("9876543210"), null);
});

test("sends a website inquiry confirmation only after explicit consent", async () => {
  configureWhatsApp();
  const calls = mockEmailAndWhatsApp();
  const res = createMockResponse();

  await inquiriesApi({
    method: "POST",
    body: validInquiry({
      whatsapp_phone: "+919876543210",
      whatsapp_consent: "on"
    }),
    headers: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.whatsappWarning, false);
  const messageCall = calls.find((call) => call.url.includes("graph.facebook.com"));
  assert.ok(messageCall);
  assert.equal(messageCall.options.headers.Authorization, "Bearer server-only-whatsapp-test-token");
  const message = JSON.parse(messageCall.options.body);
  assert.equal(message.to, "919876543210");
  assert.equal(message.type, "template");
  assert.equal(message.template.name, "website_inquiry_confirmation");
});

test("does not send WhatsApp messages without explicit consent", async () => {
  configureWhatsApp();
  const calls = mockEmailAndWhatsApp();
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry(), headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.whatsappWarning, false);
  assert.equal(calls.some((call) => call.url.includes("graph.facebook.com")), false);
});

test("reports an unavailable WhatsApp template without losing a sent inquiry", async () => {
  configureWhatsApp();
  delete process.env.WHATSAPP_TEMPLATE_NAME;
  const calls = mockEmailAndWhatsApp();
  const res = createMockResponse();

  await inquiriesApi({
    method: "POST",
    body: validInquiry({
      whatsapp_phone: "+919876543210",
      whatsapp_consent: "on"
    }),
    headers: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.whatsappWarning, true);
  assert.equal(calls.filter((call) => call.url === "https://api.resend.com/emails").length, 1);
});

test("rejects consent without a valid WhatsApp number", async () => {
  const res = createMockResponse();
  await inquiriesApi({
    method: "POST",
    body: validInquiry({ whatsapp_consent: "on", whatsapp_phone: "9876543210" }),
    headers: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /country code/i);
});

test("verifies the Meta webhook challenge", async () => {
  configureWhatsApp();
  const req = createWebhookRequest(
    "GET",
    "/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge-123"
  );
  const res = createWebhookResponse();

  await whatsappWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, "challenge-123");
});

test("rejects unsigned webhooks and auto-replies only to signed incoming messages", async () => {
  configureWhatsApp();
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "123456789012345" },
          messages: [{ from: "919876543210", id: "message-id", type: "text" }]
        }
      }]
    }]
  };
  let apiCalls = 0;
  global.fetch = async (url, options) => {
    apiCalls += 1;
    assert.match(url, /\/v99\.0\/123456789012345\/messages$/);
    const body = JSON.parse(options.body);
    assert.equal(body.to, "919876543210");
    assert.match(body.text.body, /Thanks for messaging People Pursuit/);
    return { ok: true, status: 200 };
  };

  const body = JSON.stringify(payload);
  const unsignedResponse = createWebhookResponse();
  await whatsappWebhook(
    createWebhookRequest("POST", "/api/whatsapp-webhook", body),
    unsignedResponse
  );
  assert.equal(unsignedResponse.statusCode, 401);
  assert.equal(apiCalls, 0);

  const signedPayload = signedWebhookRequest(payload);
  const signedResponse = createWebhookResponse();
  await whatsappWebhook(
    createWebhookRequest("POST", "/api/whatsapp-webhook", signedPayload.body, signedPayload.signature),
    signedResponse
  );
  assert.equal(signedResponse.statusCode, 200);
  assert.equal(apiCalls, 1);
});
