# Job posting setup

The public job posting flow uses a Vercel serverless API and a Supabase Postgres table. Job submissions are private until an administrator approves them.

## 1. Create the Supabase table

In the Supabase project SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).

## 2. Configure Vercel

In the Vercel project settings, add these environment variables for the Production environment (and Preview if needed):

- `SUPABASE_URL`: the Supabase project URL, such as `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key

Redeploy after setting the variables. Keep the service-role key only in Vercel server-side environment variables; never add it to HTML, browser JavaScript, or a committed environment file. The API fails closed when the variables are missing.

## 3. Review and publish submissions

Submitted postings are inserted with `status = 'pending_review'`. In the Supabase Table Editor, review the content and then set an approved row's `status` to `published`. Only published postings are returned to the public jobs page. Set `status` to `rejected` to decline a submission or `closed` to remove a filled role from public listings.

The application email is displayed to visitors so they can contact the employer. The API limits each application email to five submissions per 24-hour period.
