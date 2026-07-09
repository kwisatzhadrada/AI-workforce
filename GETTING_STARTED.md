# Getting Started

This guide assumes someone has already deployed the AI Workforce Network
app for you (see `DEPLOYMENT_GUIDE.md` if that's your job) — you just have
a URL, a login, and ten minutes.

## What you'll have at the end

A real B2B Sales Team — a Lead Research Agent, an Outreach Agent, and a
CRM Agent — connected to your real Gmail, Hunter.io, and HubSpot accounts,
running a real outbound campaign against real prospects, with your
explicit approval before anything is sent.

## Step 1 — Sign up and click "Get Started"

Create your account, then click **Get Started** in the top navigation.
This opens the guided setup — everything from here happens on one page.

## Step 2 — Create your organization & deploy your workforce

Enter your business name and (optionally) your industry, then click
**Create Organization & Deploy Workforce**. This single click:

- Creates your organization
- Deploys four AI agents: a Sales Agent (manager), a Lead Research Agent,
  an Outreach Agent, and a CRM Agent
- Sets up the three-step pipeline they'll run: Research Prospect →
  Outreach → Update CRM

No SQL, no configuration files, no agent setup forms.

## Step 3 — Connect your integrations

You'll need:

- **Gmail** — click "Connect with Google" and sign in. This is real
  OAuth; you'll see Google's real consent screen.
- **Hunter.io** — sign up for a free account at
  [hunter.io](https://hunter.io) (25 free searches/month), copy your API
  key from Account Settings → API, and paste it in.
- **HubSpot** (optional, recommended) — create a free HubSpot account,
  go to Settings → Integrations → Private Apps → Create a private app,
  enable `crm.objects.contacts.read`/`.write`, and paste the generated
  token in.

You can launch a campaign with just Gmail + Hunter.io connected — HubSpot
adds CRM tracking on top.

## Step 4 — Launch your first campaign

Describe who you're selling to:

- **Target Industry** (e.g. "Fintech")
- **Company Size** (a rough band — 1-10, 11-50, etc.)
- **Location**
- **Ideal Customer Profile** — a sentence or two about who actually buys
  from you

**If you already know specific target companies**, paste their domains
directly (comma or newline separated) — you'll get real, verified contacts
at exactly those companies. **If you don't**, leave that field blank and
an AI will suggest a candidate list of company domains that might fit —
these are clearly labeled as suggestions, not verified data, since finding
companies from a description isn't something this platform's data
provider (Hunter.io) actually does. Review them before trusting the
results.

Click **Launch Campaign**.

## Step 5 — Run the campaign

You'll land on your Campaign Dashboard with three stages:

1. **Find & Enrich Prospects** — click the button. This calls Hunter.io
   for real and returns real people (name, email, title, company) at your
   target domains. Review the list — every row is a real, verified
   contact.
2. **Draft & Send Outreach** — click to draft personalized emails (an AI
   writes each one referencing the recipient's real name/title/company).
   **Nothing sends yet.** Read every draft, then click **Approve & Send**
   when you're satisfied. This is the one moment real email leaves your
   Gmail account — it only happens after your explicit click.
3. **Sync to CRM** — click to create/update the corresponding HubSpot
   contacts and log a note about the outreach.

Along the way:

- **Check Replies** — click periodically to check for real inbound
  replies (there's no automatic polling — see `BLOCKERS.md` #5).
- **Log a Booked Meeting** — once a prospect actually confirms a meeting
  (there's no calendar integration yet), log it here.
- **Pause / Stop Campaign** — visible at the top of the dashboard at all
  times.

## What you'll see measured

Prospects Found, Emails Sent, Replies, Meetings Booked, Conversion Rate,
and an Estimated Pipeline Value (set your average deal size once, and it
multiplies automatically as meetings are booked).

## If something goes wrong

See `TROUBLESHOOTING.md` — every error message this platform produces is
designed to tell you exactly what happened and what to do next.
