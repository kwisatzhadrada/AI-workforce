# Support Process — Design Partners

How a design partner gets help, and how we track and respond to it.

## How a design partner reports something

**In-app feedback widget** (bottom-right corner, on every authenticated
page): three types —

- 🐛 **Bug** — something broke or behaved unexpectedly.
- 💡 **Feature request** — something they wish existed.
- 💬 **General feedback** — anything else.

Every submission automatically captures the page URL they were on and
their account, so we never have to ask "which page were you on?"

Submissions land in `user_feedback` (visible to the submitter and to
admins only — not a public forum) and are reviewable at `/admin/feedback`.

## Triage

Check `/admin/feedback` at least once per business day during an active
design-partner engagement. For each new item:

1. **Read `TROUBLESHOOTING.md` first** — if it's a documented, known
   error message, reply directly with the fix rather than treating it as
   a new bug.
2. **Reproduce bugs against a real Postgres instance** before writing
   any fix — this project's own history (see `RELIABILITY_REPORT.md`,
   `BLOCKERS.md`) shows that fixes made without reproducing against real
   RLS/grants have introduced or missed real bugs more than once.
3. **Classify severity**:
   - **Blocking** — the design partner cannot proceed with their
     campaign at all (e.g., can't connect an integration, a stage
     silently fails). Fix same day if possible; at minimum, reply with a
     workaround within a few hours.
   - **Degraded** — they can proceed, but something is wrong or
     confusing (e.g., a badge shows the wrong state, a metric looks off).
     Fix within the week.
   - **Cosmetic / feature request** — doesn't block anything. Track in
     `BLOCKERS.md` if it's a known limitation, or a future backlog if
     it's new scope.
4. Move the status to `in_progress` while working it, `resolved` once
   fixed and verified, `closed` if it's a duplicate, won't-fix, or
   answered without a code change.

## Response expectations during an active design-partner pilot

- **Blocking issues**: acknowledge within 4 business hours, fix or
  provide a workaround within 24 hours.
- **Degraded issues**: acknowledge within 1 business day, fix within the
  week.
- **Feature requests / general feedback**: acknowledge within 2 business
  days; no fix commitment, but tell them honestly whether it's planned.

## What "fixed" means here

Per this project's standing convention: no fix ships without running
`npx tsc --noEmit` and `npm run build` clean, and any fix touching a
database function or RLS policy is verified against a real Postgres
instance (`SET ROLE authenticated` as both a legitimate org member and an
unrelated outsider) before being called done — not just reasoned about
from reading the code.

## Escalation

If a design partner is fully blocked and the fix isn't obvious within the
same day, don't let them sit — reply and say so plainly, with a realistic
timeline. A design partner losing confidence in "3-5 real businesses" this
early is a bigger cost than an honest "we're still working on this."

## Known limitations — set expectations up front

Before a design partner hits any of these themselves, `BLOCKERS.md` is the
canonical list — walk through the Critical and High items with them during
onboarding so nothing is a surprise: AI-suggested prospect domains are
unverified, drafts can be reviewed but not edited in place, one campaign
per organization at a time, no calendar integration, no background
worker (they need to check back on their campaign), and no automatic
retry beyond one immediate attempt on a transient failure.
