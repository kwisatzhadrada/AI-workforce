# First-Time User Success Report

## Method

Signup and login were driven with a real headless browser (Playwright,
against `npm run dev`) — real form fills, real clicks, real network
traffic captured. Every step past authentication (connect Gmail, deploy
workforce, launch campaign, review drafts, send, track replies, book
meetings) was verified by reading the actual component and API route
code end to end, not by guessing at behavior, because this sandbox has
no working backend to log into: `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`
is still the literal placeholder from `.env.example`
(`https://YOUR-PROJECT.supabase.co`), and `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` are all empty.
A real deployed environment (real Supabase project, real Gmail OAuth app,
real model provider key) is required to complete the live walkthrough
past the signup form — see `PRODUCTION_READINESS_AUDIT.md` and this
sprint's `DEPLOYMENT_CHECKLIST.md` for exactly what that requires.

This distinction matters: every finding below is either (a) observed
directly in a real browser, or (b) traced through the real code path a
browser session would execute — never assumed.

## Findings, in the order a new user hits them

### 1. CRITICAL — A brand-new signup lands on an agent marketplace directory, not the onboarding wizard
**Where users will quit.** Before this sprint: `app/page.tsx` redirected
every authenticated user to `/agents` unconditionally. `/agents` is a
public, filterable directory of *other people's* AI agents — categories,
reputation scores, verification levels — a leftover from this project's
very first framing. A user who just signed up to "get an AI sales team
booking meetings" instead sees a marketplace of unrelated agent profiles,
with zero indication of what to do next, other than a purple "Get
Started" button in the top nav they have no reason yet to notice.

The guided onboarding wizard (`/onboarding`, `OnboardingWizard.tsx`)
already existed, was already well-built (a clean 3-step flow: deploy
workforce → connect Gmail/Hunter.io → launch campaign, correctly gated
so each step only unlocks once the previous one is real), and nothing
routed a new user into it.

**Fixed this sprint:** a new shared helper, `lib/onboarding.ts`'s
`getPostAuthDestination()`, checks whether the signed-in user owns or
belongs to any organization; if not, every post-auth redirect (root page,
login, signup, and the email-confirmation callback) now sends them to
`/onboarding` instead of `/agents`. An existing user with an organization
still lands on `/agents` exactly as before — this only changes the
brand-new-user path.

### 2. HIGH — The product's only public-facing copy described an abandoned concept
**Where users will get confused, before they even sign up.** The page
`<title>`/meta description (what shows in a browser tab, a search result,
or a shared link preview), the login page's subtitle ("Sign in to manage
your agents"), and the signup page's subtitle ("Register and manage AI
worker identities") all still described Phase 1's original "AI agent
identity/marketplace" concept — not the B2B sales campaign product this
platform has actually been for the last 20+ phases, and a description
that directly contradicts this project's own "no marketplace" constraint.

There is no separate marketing site — `/` always redirects, so the
login/signup pages are the de facto front door.

**Fixed this sprint:** rewrote the `<title>`/description
(`app/layout.tsx`), the login subtitle, and the signup page's heading and
subtitle to state the real product and its real mechanism in one
sentence, plus added two short trust lines to the signup page ("Your
Gmail, not a shared sender" / "You approve every email") answering the
"why should I trust this" question the mission's landing-page objective
asks for. See `LANDING_PAGE_AUDIT.md` for the full copy audit.

### 3. MEDIUM — A network failure shows a raw, unhelpful error
**Where users will get confused.** Confirmed live: with no reachable
Supabase project, submitting the signup form produced the literal text
"Failed to fetch" as the user-facing error — accurate to the JavaScript
exception, meaningless to a real person. This isn't just a sandbox
artifact: the same raw message would appear for any real user hitting a
transient network blip or a misconfigured deployment, and gave no
indication of what to do about it.

**Fixed this sprint:** `lib/utils.ts`'s new `friendlyAuthError()` detects
network-level failures specifically and replaces them with an actionable
message ("Couldn't reach the server. Check your connection and try
again…"), while leaving every other real Supabase error message (wrong
password, unknown email, weak password) untouched, since those are
already clear.

### 4. Low — Two integrations are required before a campaign can launch
**Where users might quit, but for a legitimate reason.** The onboarding
wizard's step 2 requires both Gmail and Hunter.io connected before
unlocking step 3 — correct, since the research and outreach stages
genuinely can't run without both. A user who wants to "just try it"
without a Hunter.io account will get stuck here. This is a real
functional requirement, not a bug, and not something this sprint's "no
new architecture" scope should work around (e.g. a fake/sample-data mode
would misrepresent what the product actually does). Documented as a
known drop-off point, not fixed.

### What already works well (verified by code trace, not assumed)
- The onboarding wizard's three steps are correctly gated in the right
  order and never show a step as falsely complete (`step1Done`/
  `step2Done`/`step3Done` in `OnboardingWizard.tsx` all check for real
  underlying data, not just a row existing).
- The campaign launch form (`CampaignLaunchForm.tsx`) uses plain business
  language throughout ("Ideal Customer Profile Description," not "ICP"),
  explains what happens next in one sentence, and never auto-sends
  anything without a step in between.
- Sending real email requires an explicit native `confirm()` dialog
  naming the exact number of emails and stating "This cannot be undone"
  (`DraftsReview.tsx`) — the one truly irreversible action in the whole
  flow has real friction on purpose.
- Reply checking, meeting logging, and the Partner Workspace (Phase 22)
  all use plain business language with no agent/workflow/task
  terminology, confirmed by rereading every relevant component this
  sprint.

## Recommended fixes not done this sprint

- **Add a "why Hunter.io" explainer** at the exact point onboarding step 2
  requires it, for the user who doesn't have an account yet and doesn't
  know what it is — a copy-only fix, reasonable next-sprint work.
- **A true marketing landing page at `/`** for logged-out visitors, distinct
  from the login form itself — out of scope for "no new architecture"
  this sprint; the login/signup pages were rewritten in place instead.
