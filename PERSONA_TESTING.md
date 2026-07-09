# Real-World Persona Testing

A desk-based walkthrough of the actual screens, copy, and code paths as
three realistic design-partner personas. Docker isn't available in this
sandbox, so a live signup-through-campaign click-through wasn't possible
(the same honest limitation noted in every prior sprint) — this is a
careful trace through the real UI copy, the real onboarding logic, and
the real database seed data each persona would actually encounter, not a
hypothetical.

---

## Persona 1: Small Agency (running outbound for multiple clients)

**Journey**: Signs up → Get Started → deploys a workforce for Client A →
wants to onboard Client B.

**Where it breaks down**: `/onboarding` has no concept of "which of my
organizations am I working on right now." It reads an `?org=` query
param; without one, it always shows the Step 1 *create a new
organization* form. There is no "switch organization" or "my
organizations" picker anywhere in the guided flow — an agency managing 3
client accounts has to know to separately visit `/organizations` (the
generic directory, built for the original agent-network product, not
styled for this) and search by name to find Client B's org and its
Campaign tab. **This is a real, meaningful gap specifically for the
agency persona** — multi-client management is core to how an agency
actually works, and nothing in the guided path acknowledges more than one
organization exists.

**A real, if smaller, confusion point**: the ROI dashboard's "Average
Deal Value" field is ambiguous for an agency. Is it the agency's own fee
for running the campaign, or the end client's average sale? The copy
("used to estimate pipeline value from meetings booked") doesn't say,
and the two produce very different numbers for the same input.

**What would go right**: once inside a specific client's Campaign tab,
the mental model (find prospects → draft → approve → send → track) maps
almost exactly onto how an agency already thinks about running outbound
for a client — this is the smoothest-fitting persona of the three for
the actual campaign mechanics themselves.

---

## Persona 2: Recruiter (sourcing candidates for open roles)

**Where it breaks down immediately, and completely**: a recruiter's
entire mental model is *candidates*, not *company prospects*. The
guided ICP form asks for "Target Industry / Company Size / Location /
Ideal Customer Profile" — a recruiter would naturally type something
like *"Senior backend engineers with 5+ years Python, fintech
experience"* into that field, expecting candidate sourcing. What
actually happens: the system either asks an LLM to suggest company
*domains* matching that description (nonsensical for a candidate
profile), or, if the recruiter pastes real domains, Hunter.io enriches
those domains into *random employees at those companies* — not
candidates screened against role requirements. There is no candidate
database, no résumé/LinkedIn-profile sourcing, and no notion of a "role"
anywhere in this pipeline. **This is a complete product-vertical
mismatch, not a UX rough edge.**

**The more actionable version of this finding**: a "Recruiting Team"
workforce template *already exists* in this platform (Phase 7 — Sourcing
Agent, Screening Agent, Interview Coordinator Agent, a real 4-step
workflow) — but the guided onboarding flow (`/onboarding`) hardcodes the
B2B Sales Team template and never offers Recruiting Team as a choice, so
a recruiter would never even see it through the intended path. And
critically, even if they found it via `/templates` directly: **checked
directly in the seed data — none of the Recruiting Team's three
capabilities carry an `integration_action`, unlike every B2B Sales Team
capability.** They are bare LLM-call capabilities with zero real
external system behind them (no ATS, no LinkedIn, no job board). A
recruiter deploying it would get a generative-text description of "how
one might source candidates," not real candidates. Sourcing Agent,
Screening Agent, and Interview Coordinator Agent have existed as
schema/seed placeholders since Phase 7 and have never been wired to
anything real — same story for Customer Support Team, Research Team, and
Content Marketing Team. **Only the B2B Sales Team vertical has ever had
real integrations built for it.**

---

## Persona 3: SaaS Founder (running their own outbound)

**Closest fit alongside the agency persona** — "B2B SaaS" is literally
the placeholder industry text used throughout the onboarding form, and a
founder selling their own product maps directly onto the built pipeline:
their own Gmail, their own target ICP, their own deal value (unambiguous
here, unlike the agency case — it's their own average contract value).

**A real, checkable friction point specific to this persona**: a SaaS
founder is likely to connect a **Google Workspace** account (their real
company email), not a personal Gmail. Google Workspace admins can
restrict which third-party OAuth apps are allowed to request sensitive
scopes (`gmail.send` is exactly this kind of scope) for the whole
domain. A founder whose Workspace has this restriction enabled would hit
a Google-side block during the OAuth consent flow that has nothing to do
with this platform's own code — and **this exact scenario isn't
documented anywhere in `TROUBLESHOOTING.md` or `DEPLOYMENT_GUIDE.md`
today.** Added to `TROUBLESHOOTING.md` this sprint (see below).

**A smaller, cosmetic confusion**: `deploy_workforce_template()`
auto-creates seven departments (Sales, Marketing, Research, Operations,
Support, Finance, Development) for every organization, regardless of
size. A solo or two-person SaaS founder deploying their first workforce
would see a "Finance department" and a "Development department" appear
for a company that has neither — harmless (nothing requires they be
used), but reads as enterprise-shaped overhead for what should feel like
a lightweight tool.

---

## Cross-persona finding: the "AI Workforce Network" framing itself

All three personas, before ever reaching a campaign, pass through global
nav and page copy (`Agents`, `Rankings`, agent reputation/trust scores,
agent wallets) that frames this as a general-purpose *marketplace of AI
workers* — none of that vocabulary appears anywhere in the actual guided
B2B sales journey, but it's the first thing visible in the top nav and
the page a signed-out visitor's "AI Workforce" logo link points to. A
design partner evaluating "is this built for my exact use case" would
reasonably read that framing as "general AI agent platform," then
discover, only after clicking through, that exactly one vertical (B2B
sales) is real. This is the same finding as the recruiter mismatch above,
generalized: **the product's own framing oversells its breadth relative
to what's actually real today.**
