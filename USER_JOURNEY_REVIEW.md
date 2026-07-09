# User Journey Review

Every screen in the app, audited for a non-technical design partner running
one B2B sales campaign — not for the power users the original "AI
Workforce Network" (Phases 1-9) was built for. Three questions per screen:
**why does it exist, is it understandable to a non-technical user, can it
be simplified.** One concrete simplification was made this sprint (the
nav collapse, below); the rest are documented findings for
`DESIGN_PARTNER_READINESS_REPORT.md` rather than acted on, since most
require either a product decision (hide a feature entirely?) or touch
shared code used by non-design-partner users too.

## The single highest-leverage finding: nav clutter

**Before this sprint**, every signed-in user saw up to 9 flat top-level
nav links (Get Started, Agents, Rankings, Templates, Organizations,
Goals, Tasks, Executions, Messages), and an admin saw **15** — six of
them (Admin, System Health, Intelligence, Diagnostics, Analytics,
Feedback) added one at a time across four separate sprints, each reasoned
about in isolation ("admin needs a link to the new page"), never revisited
as a whole. A design partner's entire real journey is **Get Started →
Organizations → (their org's Campaign tab) → Messages** (to see agent
alerts) — the other 6 links expose the platform's original agent-network
concepts (identity, reputation, wallets, generic task/goal primitives)
that a business running one guided sales campaign never needs to touch,
and that read as confusing, unrelated surface area if clicked by mistake.

**Fixed this sprint**: `Agents`/`Rankings`/`Templates`/`Goals`/`Tasks`/
`Executions` now live behind one "Workspace" dropdown; the six admin
links collapse into one "Admin" dropdown. A signed-in design partner now
sees 4 direct items (Get Started, Organizations, Messages, Workspace) —
down from 9 — and nothing was removed or made unreachable, just no longer
competing for attention by default.

## Per-screen review

### Auth

| Screen | Why it exists | Understandable? | Simplify? |
|---|---|---|---|
| `/login` | Entry point | Yes — 2 fields, clear copy ("Sign in to manage your agents") | No change needed |
| `/signup` | Account creation | Yes — 3 fields | No change needed |

### The guided path (built for design partners)

| Screen | Why it exists | Understandable? | Simplify? |
|---|---|---|---|
| `/onboarding` | The whole point of the last two sprints — one page, org+workforce → integrations → campaign | Yes, by design — plain-language copy, numbered steps, real-time state | Already the simplified path; see `BLOCKERS.md` for what's still rough (draft editing, regenerate) |
| `/organizations/[id]?tab=campaign` | Where a launched campaign actually runs | Mostly — stage cards, clear approve/send gate | The `Team`/`Trust Score` framing on the **Overview** tab (the tab a user lands on by default before Campaign) uses agent-network vocabulary ("Trust Score") a business owner won't intuitively parse — low-severity, cosmetic |
| `/organizations/[id]?tab=integrations` | Connect Gmail/HubSpot/Hunter | Yes | No change |
| `/organizations/[id]?tab=setup` | Read-only checklist, largely superseded by the Campaign tab's own stage indicators | Yes, but now redundant with Campaign tab | **Candidate to remove or fold into Campaign tab** — it duplicates information the Campaign Dashboard already shows more usefully; kept out of caution (not touched this sprint since it's separately linked from `DEPLOYMENT_GUIDE.md`) |

### Organization sub-tabs built for the original agent-network vision

| Tab | Why it exists | Understandable? | Simplify? |
|---|---|---|---|
| Departments | Org structure (Sales/Marketing/etc.) from Phase 3 | Understandable, but a design partner never needs to touch it — the template deploys sensible defaults | Not shown as a nav priority; fine to leave as-is for power users |
| Agents (org tab) | Per-org agent assignment view | Same agent-network vocabulary as the global Agents directory | No change — power-user feature |
| Performance | Trust-score/utilization charts | Uses "Trust Score," "Utilization" — internal concepts | No change — not part of the guided path |
| Tasks (org tab) | Raw task queue for this org | A design partner's tasks are already being run through the Campaign Dashboard — visiting this tab directly shows the same 3 tasks with no campaign framing, which could confuse someone who stumbles onto it looking for "my campaign" | Low priority: the Campaign tab already covers this need; this tab remains for anyone managing tasks outside a campaign context |
| Workflows | Generic workflow builder (Phase 3) | Not used by the B2B Sales template's guided flow at all | Genuinely unnecessary for a design partner; left in place for other workforce templates that might use it |
| Activity | Raw event feed | Understandable as a log, but no narrative | Fine as a power-user/debugging view |
| Sales Pipeline | Metrics + raw activity feed — now mostly redundant with the Campaign tab's own metrics row | Yes | Redundant with Campaign tab; not merged this sprint to avoid disrupting anyone who bookmarked it directly |

### Global agent-network pages (not part of the guided B2B sales journey at all)

`/agents`, `/agents/new`, `/agents/top`, `/agent/[id]`, `/agent/[id]/edit` — these are the **original product** (Phase 1-2): register an individual AI agent, browse/rank the network, manage its wallet/reputation/credentials. A design partner deploying the B2B Sales Team template never manually registers an agent or visits these — their four agents already exist, fully configured, the moment they deploy. These pages are completely reasonable *for their original purpose* but are pure noise for a design partner; the nav collapse (above) is the safe fix given the pages themselves still serve other real users of this platform.

`/tasks`, `/tasks/new`, `/tasks/[id]`, `/goals`, `/goals/new`, `/goals/[id]`, `/executions`, `/executions/[id]` — same story: generic primitives from Phases 4-6 that the B2B Sales Team's guided flow now sits *on top of* (a campaign is a goal; a stage is a task; running a stage is an execution) — but a design partner should never need to know that. Visiting `/goals/new` and being asked for a "manager agent," "target metrics," and "priority" is squarely developer/power-user territory. These pages are correctly out of the way behind the Workspace dropdown now; no further change made this sprint since removing them would break the platform for organizations not using the guided campaign flow.

`/templates`, `/templates/[id]` — the origin of the B2B Sales Team deployment, but a design partner never visits these directly (`/onboarding` deploys the template for them, pre-selected, without ever showing a template browser). Reasonable to leave as-is; a browsing UI is appropriate once more templates exist.

`/messages` — genuinely useful (agent alerts, e.g. escalations), understandable, no change needed.

### Admin-only pages

`/admin/verifications`, `/system-health`, `/intelligence`, `/diagnostics`, `/analytics`, `/admin/feedback` — all correctly admin-gated, never seen by a design partner unless they're also the platform operator. Collapsed into one "Admin" dropdown this sprint (see above) purely to reduce visual clutter for admins juggling both roles.

## What this review recommends, not fixed this sprint

1. **Consider whether the Setup Wizard and Sales Pipeline tabs should be removed or merged into the Campaign tab** — they're redundant with it now, and every redundant surface is one more place information can drift out of sync (a real risk, not hypothetical — see the design-partner-dashboard/onboarding-funnel work this same sprint, which had to be careful not to duplicate logic in two places). Not done this sprint: removing a tab a design partner might have bookmarked is a real, if small, breaking change that deserves a product decision, not a unilateral cut.
2. **The organization page's default tab (`Overview`) uses "Trust Score" without explanation.** Low severity — cosmetic, doesn't block anything, but worth a one-line explanatory tooltip eventually.
3. **No user-type/role concept distinguishes "design partner on the guided path" from "power user managing agents directly."** This is why the nav fix collapses rather than removes — there's no clean way to know who should see what without inventing a new concept, which is out of scope ("no new architecture"). Worth a future design partner v2 conversation, not a sprint-1 build item.
