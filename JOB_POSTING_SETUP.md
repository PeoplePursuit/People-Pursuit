# Job posting setup

The public job posting flow uses a Vercel serverless API, a Supabase Postgres table, and Resend for notifications. New job listings are published automatically after the notification email is accepted by Resend.

## 1. Create the Supabase table

In the Supabase project SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).

## 2. Configure Vercel

In the Vercel project settings, add these environment variables for the Production environment (and Preview if needed):

- `SUPABASE_URL`: the Supabase project URL, such as `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key
- `RESEND_API_KEY`: a Resend API key with permission to send email
- `JOB_NOTIFICATION_FROM`: a sender address verified in Resend, such as `People Pursuit <jobs@your-verified-domain.in>`

Redeploy after setting the variables. Keep both API keys only in Vercel server-side environment variables; never add them to HTML, browser JavaScript, or a committed environment file. The API refuses new submissions when Supabase or email notification settings are missing.

## 3. Automatic publishing and notification

Each submission is first saved as `pending_review` so it cannot appear publicly before the notification succeeds. The API sends the job details to `contactus@peoplepursuit.in` through Resend, then changes the status to `published`. Only published postings appear on the jobs page. If notification delivery fails, the submission remains hidden with `pending_review`; inspect and resolve it in Supabase. Set `status` to `rejected` to decline a submission or `closed` to remove a filled role from public listings.

The application email is displayed publicly so candidates can contact the employer. The form checks email syntax but does not verify mailbox ownership or that an address belongs to a company. The API limits each submitted email to five postings per 24-hour period; without mailbox verification, this limit is not an identity check.
