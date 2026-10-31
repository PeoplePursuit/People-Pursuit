const ALLOWED_EMPLOYMENT_TYPES = new Set([
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship"
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 12000;
const DAILY_POST_LIMIT = 5;
const JOB_NOTIFICATION_EMAIL = "contactus@peoplepursuit.in";

function sendJson(res, status, value) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(value);
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return null;
    }
    return { restUrl: url.origin + url.pathname.replace(/\/$/, "") + "/rest/v1", serviceRoleKey };
  } catch {
    return null;
  }
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.JOB_NOTIFICATION_FROM;
  return apiKey && from ? { apiKey, from } : null;
}

function getHeaders(serviceRoleKey, extraHeaders) {
  return {
    apikey: serviceRoleKey,
    Authorization: "Bearer " + serviceRoleKey,
    ...extraHeaders
  };
}

function validateJob(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Please submit a valid job posting." };
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return { error: "The job posting could not be accepted." };
  }

  const fields = {
    company_name: 120,
    title: 120,
    location: 120,
    salary_range: 100,
    description: 5000,
    requirements: 3000,
    application_email: 254,
    application_url: 500
  };
  const values = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body[field] == null ? "" : body[field];
    if (typeof value !== "string" || value.length > maxLength) {
      return { error: "Please check the job details and try again." };
    }
    values[field] = value.trim();
  }

  for (const field of ["company_name", "title", "location", "description", "application_email"]) {
    if (!values[field]) {
      return { error: "Please complete all required job details." };
    }
  }

  if (!EMAIL_PATTERN.test(values.application_email)) {
    return { error: "Enter a valid application email address." };
  }
  if (!ALLOWED_EMPLOYMENT_TYPES.has(body.employment_type)) {
    return { error: "Choose a valid employment type." };
  }
  if (values.application_url) {
    try {
      const applicationUrl = new URL(values.application_url);
      if (applicationUrl.protocol !== "https:" && applicationUrl.protocol !== "http:") {
        return { error: "The application link must start with http:// or https://." };
      }
    } catch {
      return { error: "Enter a valid application link." };
    }
  }

  return {
    value: {
      company_name: values.company_name,
      title: values.title,
      location: values.location,
      employment_type: body.employment_type,
      salary_range: values.salary_range || null,
      description: values.description,
      requirements: values.requirements || null,
      application_email: values.application_email.toLowerCase(),
      application_url: values.application_url || null,
      status: "pending_review"
    }
  };
}

async function supabaseFetch(config, path, options) {
  return fetch(config.restUrl + path, {
    ...options,
    headers: getHeaders(config.serviceRoleKey, options && options.headers)
  });
}

async function sendJobNotification(emailConfig, job) {
  const details = [
    "A job listing was submitted and will be published automatically after notification succeeds.",
    "",
    "Company: " + job.company_name,
    "Job title: " + job.title,
    "Location: " + job.location,
    "Employment type: " + job.employment_type,
    "Salary: " + (job.salary_range || "Not provided"),
    "Application email: " + job.application_email,
    "Application link: " + (job.application_url || "Not provided"),
    "",
    "Description:",
    job.description,
    "",
    "Requirements:",
    job.requirements || "Not provided"
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + emailConfig.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailConfig.from,
      to: [JOB_NOTIFICATION_EMAIL],
      subject: "New job listing submitted to People Pursuit",
      text: details
    })
  });
  if (!response.ok) {
    console.error("Could not send job notification:", await response.text());
    return false;
  }
  return true;
}

async function handleGet(config, res) {
  const query = new URLSearchParams({
    select: "id,company_name,title,location,employment_type,salary_range,description,requirements,application_email,application_url,created_at",
    status: "eq.published",
    order: "created_at.desc",
    limit: "100"
  });
  const response = await supabaseFetch(config, "/job_postings?" + query.toString());
  if (!response.ok) {
    console.error("Could not load published job postings:", await response.text());
    return sendJson(res, 502, { error: "Job openings are temporarily unavailable." });
  }
  return sendJson(res, 200, await response.json());
}

async function handlePost(config, req, res) {
  const contentLength = Number(req.headers && req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { error: "The job posting is too large." });
  }

  const validation = validateJob(req.body);
  if (validation.error) {
    return sendJson(res, 400, { error: validation.error });
  }
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    return sendJson(res, 503, {
      error: "Job posting notifications are not configured. Please try again later."
    });
  }

  const rateLimitQuery = new URLSearchParams({
    select: "id",
    application_email: "eq." + validation.value.application_email,
    created_at: "gte." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    limit: String(DAILY_POST_LIMIT)
  });
  const rateLimitResponse = await supabaseFetch(config, "/job_postings?" + rateLimitQuery.toString());
  if (!rateLimitResponse.ok) {
    console.error("Could not check the job posting rate limit:", await rateLimitResponse.text());
    return sendJson(res, 502, { error: "We couldn’t submit your job right now. Please try again later." });
  }
  if ((await rateLimitResponse.json()).length >= DAILY_POST_LIMIT) {
    return sendJson(res, 429, { error: "You’ve reached the daily posting limit. Please try again tomorrow." });
  }

  const response = await supabaseFetch(config, "/job_postings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(validation.value)
  });
  if (!response.ok) {
    console.error("Could not save the submitted job posting:", await response.text());
    return sendJson(res, 502, { error: "We couldn’t submit your job right now. Please try again later." });
  }

  const [insertedJob] = await response.json();
  if (!insertedJob || !insertedJob.id) {
    console.error("Supabase did not return the saved job posting ID.");
    return sendJson(res, 502, { error: "We couldn’t confirm your job submission. Please try again later." });
  }

  let notificationSent;
  try {
    notificationSent = await sendJobNotification(emailConfig, validation.value);
  } catch (error) {
    console.error("Could not send job notification:", error);
    return sendJson(res, 502, {
      error: "Your job was saved but not published because we couldn’t notify People Pursuit. Please try again later."
    });
  }
  if (!notificationSent) {
    return sendJson(res, 502, {
      error: "Your job was saved but not published because we couldn’t notify People Pursuit. Please try again later."
    });
  }

  const publishQuery = new URLSearchParams({ id: "eq." + insertedJob.id });
  const publishResponse = await supabaseFetch(config, "/job_postings?" + publishQuery.toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "published" })
  });
  if (!publishResponse.ok) {
    console.error("Could not publish the notified job posting:", await publishResponse.text());
    return sendJson(res, 502, {
      error: "We received your job and notified People Pursuit, but couldn’t publish it yet. Please contact us."
    });
  }
  const [publishedJob] = await publishResponse.json();
  if (!publishedJob || publishedJob.status !== "published") {
    console.error("Supabase did not confirm the job posting was published.");
    return sendJson(res, 502, {
      error: "We received your job and notified People Pursuit, but couldn’t confirm publication. Please contact us."
    });
  }

  return sendJson(res, 201, {
    status: "published",
    message: "Your job is now published on the Find Jobs page."
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return sendJson(res, 503, { error: "Job posting is not configured yet." });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(config, res);
    }
    return await handlePost(config, req, res);
  } catch (error) {
    console.error("Job postings API request failed:", error);
    return sendJson(res, 502, { error: "Job postings are temporarily unavailable." });
  }
};

module.exports.validateJob = validateJob;
