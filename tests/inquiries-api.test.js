const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const inquiriesApi = require("../api/inquiries");

const originalFetch = global.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.JOB_NOTIFICATION_FROM;

function createResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    }
  };
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

function validInquiry(overrides) {
  return {
    name: "Alex Candidate",
    email: "alex@example.com",
    mobile: "+1 415 555 0136",
    service: "Permanent Staffing",
    requirements: "We need help hiring a senior engineer.",
    website: "",
    ...overrides
  };
}

function configureEmail() {
  process.env.RESEND_API_KEY = "server-only-resend-test-key";
  process.env.JOB_NOTIFICATION_FROM = "People Pursuit <jobs@example.com>";
}

afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.JOB_NOTIFICATION_FROM;
  else process.env.JOB_NOTIFICATION_FROM = originalFrom;
});

test("sends a service inquiry to People Pursuit and sets the submitter as reply-to", async () => {
  configureEmail();
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.Authorization, "Bearer server-only-resend-test-key");
    const email = JSON.parse(options.body);
    assert.deepEqual(email.to, ["contactus@peoplepursuit.in"]);
    assert.equal(email.reply_to, "alex@example.com");
    assert.match(email.text, /Mobile: \+1 415 555 0136/);
    assert.match(email.text, /Permanent Staffing/);
    assert.match(email.text, /senior engineer/);
    return createResponse(200, { id: "email-1" });
  };
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry(), headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Your inquiry has been sent.");
});

test("emails meeting requests and preferred availability to People Pursuit", async () => {
  configureEmail();
  global.fetch = async (url, options) => {
    const email = JSON.parse(options.body);
    assert.match(email.text, /Meeting requested: Yes/);
    assert.match(email.text, /Preferred meeting time: Tue, 2-4 PM IST/);
    return createResponse(200, { id: "email-meeting" });
  };
  const res = createMockResponse();

  await inquiriesApi({
    method: "POST",
    body: validInquiry({
      meeting_requested: "on",
      preferred_meeting_time: "Tue, 2-4 PM IST"
    }),
    headers: {}
  }, res);

  assert.equal(res.statusCode, 200);
});

test("requires preferred availability when a meeting is requested", async () => {
  const validation = inquiriesApi.validateInquiry(validInquiry({
    meeting_requested: "on"
  }));

  assert.match(validation.error, /preferred meeting time/i);
});

test("rejects invalid inquiry fields before sending email", async () => {
  configureEmail();
  global.fetch = async () => {
    throw new Error("Email should not be sent for invalid input");
  };
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry({ email: "invalid" }), headers: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid email/i);
});

test("rejects honeypot submissions", async () => {
  configureEmail();
  global.fetch = async () => {
    throw new Error("Email should not be sent for honeypot input");
  };
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry({ website: "spam" }), headers: {} }, res);

  assert.equal(res.statusCode, 400);
});

test("fails explicitly when email settings are missing", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.JOB_NOTIFICATION_FROM;
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry(), headers: {} }, res);

  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /temporarily unavailable/i);
});

test("fails when Resend rejects the inquiry email", async () => {
  configureEmail();
  global.fetch = async () => createResponse(500, "Provider error");
  const res = createMockResponse();

  await inquiriesApi({ method: "POST", body: validInquiry(), headers: {} }, res);

  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /couldn’t send your inquiry/i);
});

test("allows only POST requests", async () => {
  const res = createMockResponse();

  await inquiriesApi({ method: "GET", headers: {} }, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});
