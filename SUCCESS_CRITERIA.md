# Success Criteria — Design Partner Validation

What "this platform produces measurable business value for a real
business" actually means, made concrete and checkable — not a vague
impression, a specific bar every design partner either clears or doesn't.

## The funnel (tracked automatically, no manual counting)

Every design partner's progress through these seven stages is tracked in
real time — `/analytics` (admin) shows both the aggregate funnel and a
per-organization breakdown:

1. Organization created
2. Workforce deployed
3. Campaign launched
4. Emails drafted
5. Emails sent
6. Replies received
7. Meetings booked

## Per-design-partner success bar

For a single design partner's pilot to count as a genuine validation
(not just "they signed up"), all of the following must be true:

- [ ] **Reached stage 3 (campaign launched) unassisted** — no support
      request needed to get from signup to a launched campaign. If they
      needed hand-holding to get this far, that's real signal the
      onboarding flow still has friction — treat it as a `BLOCKERS.md`-
      worthy finding, not just "they figured it out eventually."
- [ ] **Reached stage 5 (emails sent) within one week of launch** —
      not stalled waiting on us, an integration, or a confusing UI.
- [ ] **At least one real reply within four weeks** — this is the first
      genuinely external signal (a real prospect responded) that the
      pipeline produces real business interest, not just activity.
- [ ] **Zero SQL, zero direct database access, zero developer
      intervention** required at any point — if we had to open the
      Supabase dashboard or run a query to unblock them, that's a real
      product gap, not a support-process win.
- [ ] **They can articulate what the platform did for them in one
      sentence** — e.g., "it found 15 real people at my target companies
      and sent them personalized emails I approved first." If they can't
      say what happened without our help explaining it, the guided UI
      isn't guiding.

## Cohort-level success bar (3-5 design partners)

- **At least 3 of 5** reach stage 5 (emails sent) within their first two
  weeks.
- **At least 1 of 5** books a real meeting within the pilot window —
  proof the full pipeline, end to end, produces an actual business
  outcome for at least one real company, not just activity metrics.
- **No design partner is blocked by the same root cause twice** — if
  the same bug or confusion hits a second design partner, it should
  already be fixed from the first (this is what `BLOCKERS.md` and the
  feedback triage process in `SUPPORT_PROCESS.md` exist to prevent).
- **Every blocking issue reported gets a same-day acknowledgment** — a
  design partner shouldn't wonder if they're being ignored.

## What would make this NOT ready for design partners

Any of these means: pause, fix, then resume — not "note it and continue":

- A design partner cannot get from signup to a launched campaign without
  our direct help, more than once across the cohort.
- A real send goes out that the design partner didn't explicitly
  approve (this would be a Critical regression in the human-approval
  gate — treat it as a stop-everything bug, not a backlog item).
- The metrics shown on a design partner's dashboard don't match what
  actually happened (a fabricated or stale number is worse than a small
  real one — this platform's whole premise is that the numbers are real).

## Honest framing for design partners themselves

Tell them, plainly, before they start: this is early. Some things are
manual (checking replies, logging meetings). Prospect suggestions from an
AI are unverified guesses if they don't bring their own target list. The
value being validated is the pipeline itself — real prospecting, real
outreach with a real human approval step, real CRM sync — not a finished,
fully-automated product yet.
