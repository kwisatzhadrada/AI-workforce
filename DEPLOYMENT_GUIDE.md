# Deployment Guide: B2B Sales Workforce (Real Gmail / HubSpot / Hunter.io)

This guide takes the B2B Sales Team workforce template from zero to a running
campaign against real external systems. It assumes no existing Supabase
project and no existing Google Cloud / HubSpot / Hunter.io accounts.

Total setup time for someone doing this the first time: roughly 45–75
minutes, most of it in Google Cloud Console's OAuth consent screen.

---

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run every file in `supabase/migrations/` **in numeric
   order**, `001` through `022` (check the directory for the current
   highest number — this guide will otherwise go stale every time a new
   migration ships). Migrations are additive — running them out of order,
   or skipping one, will break later ones.
3. Copy your project's URL and anon key (Settings → API) into `.env.local`
   (copy from `.env.example` first).
4. Set `is_admin = true` on your own row in `public.profiles` if you want
   access to `/admin`, `/system-health`, and `/intelligence` — none of these
   are required for the sales campaign itself.

## 2. Deploy the app

Any Next.js host works; these steps assume Vercel.

1. Push this repo to GitHub, import it into Vercel.
2. Set the environment variables from `.env.local` (Section 1, plus
   Sections 3–5 below) in the Vercel project settings.
3. Note your deployed URL (e.g. `https://your-app.vercel.app`) — you need
   it for the Gmail OAuth redirect URI in the next section.
4. Redeploy after adding env vars (Vercel doesn't hot-reload them).

**You need a real, publicly reachable URL before Gmail OAuth will work.**
`localhost` only works if you're testing from the same machine that has the
OAuth client's redirect URI registered for `localhost`.

## 3. Gmail (real OAuth2)

This is the most involved step. Google gates the `gmail.send` scope behind
its OAuth consent screen process.

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or reuse one).
2. **APIs & Services → Library** → search "Gmail API" → Enable.
3. **APIs & Services → OAuth consent screen**:
   - User type: External (unless you have a Google Workspace org — then
     Internal is simpler and skips verification entirely).
   - Fill in app name, support email, developer contact.
   - Scopes: add `.../auth/gmail.send`, `.../auth/gmail.readonly`,
     `.../auth/userinfo.email`.
   - **Publishing status: leave it in "Testing."** In Testing mode you can
     add up to 100 explicit test-user Google accounts and use sensitive
     scopes immediately, with no Google security review. Moving to
     "Production" with these scopes triggers a manual verification process
     that can take **days to weeks** — skip this for a pilot/demo. Add every
     Gmail account you intend to connect (yours, and anyone else on the
     sales team) as a test user.
4. **APIs & Services → Credentials** → Create Credentials → OAuth client ID
   → Application type: **Web application**.
   - Authorized redirect URI: `https://your-app.vercel.app/api/integrations/gmail/callback`
     (must match `GOOGLE_REDIRECT_URI` exactly, including scheme and no
     trailing slash).
5. Copy the generated Client ID and Client Secret into your env vars:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/integrations/gmail/callback
   ```
6. From the organization's **Integrations** tab in the app, click "Connect
   with Google," sign in as a test-user account, and approve. You'll be
   redirected back with `?connected=gmail` on success.

**Known friction:** if the account you connect has previously granted this
same app access and later click "Connect" again, Google may not return a
refresh token on the second consent (it only issues one on first consent
per app, unless you force re-consent). The `connect/callback` route already
requests `prompt=consent` for exactly this reason, but if you ever manually
revoke access, do it from
[myaccount.google.com/permissions](https://myaccount.google.com/permissions)
and reconnect fresh rather than just re-clicking "Connect" in the app.

## 4. HubSpot (Private App token — no OAuth needed)

1. Create a free [HubSpot](https://www.hubspot.com/) account (or use an
   existing one — a free CRM account is enough for this).
2. **Settings (gear icon) → Integrations → Private Apps → Create a private
   app.**
3. Name it (e.g. "AI Workforce Network"), then under **Scopes** enable at
   least:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
4. Create app → copy the generated **access token** (shown once).
5. From the organization's Integrations tab, paste the token into the
   HubSpot field and click Connect. No redirect, no callback — this is a
   direct API call.

**Known friction:** the token is stored as-is in
`organization_integrations.credentials` — there's no encryption-at-rest for
this column yet (see the due-diligence report, Section 1/3). Treat it like
any other production secret: don't paste it anywhere else, and revoke it
in HubSpot immediately if this Supabase project's service key is ever
exposed.

## 5. Hunter.io (API key — no OAuth needed)

1. Sign up at [hunter.io](https://hunter.io/) — the free plan includes 25
   searches/month, enough for a small pilot.
2. **Account settings → API** → copy your API key.
3. From the organization's Integrations tab, paste the key into the
   Hunter.io field and click Connect.

**Known limitation, not a setup step:** Hunter's Domain Search finds real
people at a domain you already know. It does not discover companies from an
industry/size description — "give me 20 Series A fintech companies" isn't
something this integration (or Hunter.io itself, on the free tier) can do.
You need to arrive with a list of target company domains already in hand
(an account list export from LinkedIn Sales Navigator, a spreadsheet, a
competitor's customer list, etc.).

## 6. Deploy the workforce template and run the campaign

1. `/templates` → **B2B Sales Team** → Deploy, giving it an organization
   name.
2. Open the new organization → **Setup Wizard** tab. It tracks the four
   remaining steps (connect the three integrations above, then approve a
   goal plan) and links straight to each one.
3. `/goals` → your organization → the **Generate Leads** goal → create a
   plan (or accept the AI-drafted one, if you've configured `OPENAI_API_KEY`
   or `ANTHROPIC_API_KEY`) with a first step titled **"Research Prospect"**
   whose **description contains your real target domains**, e.g.:
   > Enrich target market: acme.com, beta.io, gamma-corp.com
4. Approve the plan. This creates a real task assigned to an agent.
5. **Before running it — check who it's assigned to.** See "Known issue"
   below; the auto-assignment can pick the wrong agent. Open the task and
   confirm (or manually reassign) the "Research Prospect" task to the
   **Lead Research Agent**, "Outreach" to the **Outreach Agent**, and
   "Update CRM" to the **CRM Agent**.
6. From each task's detail page, pick that agent's real capability
   (Prospect Research / Outreach Send / CRM Sync) and click **Run
   Execution**. Watch the organization's **Sales Pipeline** tab for Leads
   Found, Emails Sent, Replies Received to update in real time as each step
   completes.
7. Click **Check Replies** periodically (there's no background poller in
   this stack — see the main README) to detect real inbound replies.
8. Log a meeting manually from the Sales Pipeline tab once a prospect
   actually confirms one — there's no calendar integration yet, so this
   step is never automatic.

### Known issue: verify agent assignment before running anything

The goal-driven auto-assignment (`assign_best_agent_for_task`, from Phase
6) can assign the wrong agent to a step when multiple agents in the
organization have the same (default, 0) trust score — its capability match
is a soft heuristic and isn't required for the assignment to go through.
This was caught during validation: a fresh deployment's "Research Prospect"
task was auto-assigned to the **CRM Agent** instead of the **Lead Research
Agent**. Running the wrong capability on a task fails confusingly ("no
enriched leads found") rather than obviously. **Always open a freshly
auto-assigned task and confirm the agent before running its execution** —
see `SALES_VALIDATION_REPORT` for the full root cause and severity.

---

## Environment variable summary

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

SUPABASE_SERVICE_ROLE_KEY=  # required — powers the hourly cron worker (Settings -> API -> service_role)
CRON_SECRET=                 # required — any random string; also set as the cron route's Bearer check

OPENAI_API_KEY=            # optional — only needed for AI-drafted goal plans
ANTHROPIC_API_KEY=         # optional — alternative to OpenAI
LOCAL_MODEL_URL=           # optional — Ollama-compatible, only if self-hosting a model

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/integrations/gmail/callback
```

HubSpot and Hunter.io need no server-side environment variables — both
connect by pasting a token/key directly from the organization's
Integrations tab.

**Without `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` set, autonomous
background execution silently never runs** — no reply checks, no CRM
sync, no executive briefs, no campaign progression happen unless a human
clicks the corresponding button every time. Vercel reads `vercel.json`'s
`crons` entry automatically on deploy; no separate dashboard step is
needed beyond setting these two variables.
