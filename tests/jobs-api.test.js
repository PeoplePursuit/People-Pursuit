const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const jobsApi = require("../api/jobs");

const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
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

function validPosting(overrides) {
  return {
    company_name: "Example Company",
    title: "Software Engineer",
    location: "Remote",
    employment_type: "Full-time",
    salary_range: "",
    description: "Build and maintain web applications.",
    requirements: "",
    application_email: "jobs@example.com",
    application_url: "",
    website: "",
    ...overrides
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = originalUrl;
  }
  if (originalServiceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }
});

test("returns only published job postings", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  global.fetch = async (url, options) => {
    assert.match(url, /status=eq\.published/);
    assert.equal(options.headers.Authorization, "Bearer server-only-test-key");
    return createResponse(200, [{ id: "job-1", title: "Software Engineer" }]);
  };
  const res = createMockResponse();

  await jobsApi({ method: "GET" }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, [{ id: "job-1", title: "Software Engineer" }]);
});

test("rejects a job with invalid required fields before calling Supabase", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  global.fetch = async () => {
    throw new Error("Supabase should not be called for invalid input");
  };
  const res = createMockResponse();

  await jobsApi({ method: "POST", body: validPosting({ title: "" }), headers: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /required job details/i);
});

test("saves a valid job as pending review", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  let inserted;
  global.fetch = async (url, options) => {
    if (options.method === "POST") {
      inserted = JSON.parse(options.body);
      return createResponse(201, [inserted]);
    }
    return createResponse(200, []);
  };
  const res = createMockResponse();

  await jobsApi({ method: "POST", body: validPosting({}), headers: {} }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.status, "pending_review");
  assert.equal(inserted.application_email, "jobs@example.com");
  assert.equal(res.body.status, "pending_review");
});

test("does not accept public posts when server-side configuration is missing", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = createMockResponse();

  await jobsApi({ method: "GET" }, res);

  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /not configured/i);
});

test("enforces the daily posting limit for an application email", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  global.fetch = async (url) => {
    assert.match(url, /application_email=eq\.jobs%40example\.com/);
    return createResponse(200, Array.from({ length: 5 }, (_, index) => ({ id: index })));
  };
  const res = createMockResponse();

  await jobsApi({ method: "POST", body: validPosting({}), headers: {} }, res);

  assert.equal(res.statusCode, 429);
  assert.match(res.body.error, /daily posting limit/i);
});

test("rejects non-web application links", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  global.fetch = async () => {
    throw new Error("Supabase should not be called for an invalid application link");
  };
  const res = createMockResponse();

  await jobsApi({
    method: "POST",
    body: validPosting({ application_url: "javascript:alert(1)" }),
    headers: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /http:\/\/ or https:\/\//i);
});
