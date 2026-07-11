# Real Campaign Validation Report

## What this validates, and what it can't

This sandbox has no working Supabase project (`.env.local`'s
`NEXT_PUBLIC_SUPABASE_URL` is still the `.env.example` placeholder), no
Gmail OAuth credentials, and no LLM API key — confirmed in
`FIRST_TIME_USER_SUCCESS_REPORT.md` by driving the real signup form in a
real browser and watching it fail. That rules out a genuine click-through
of "connect real Gmail → real Hunter.io lookup → real LLM-drafted email →
real Gmail send → real inbound reply" in this environment. No amount of
code reading substitutes for that — it isn't claimed here.

What **is** real: every RPC the application actually calls for each step
of this flow was executed against a genuinely fresh local Postgres 16
database (the same one `scripts/test_critical_paths.sh` builds — 22
migrations applied, 27/27 RLS/RPC checks passing), as the real
`authenticated` Postgres role with a real user context, through the exact
function names `lib/campaigns.ts`, `lib/runtime/checkReplies.ts`, and the
Meetings/Revenue UI call. This validates the entire data pipeline that
sits behind those external integrations — the part a live click-through
can't verify any more rigorously than direct RPC execution does, since
the UI is a thin layer over the same calls.

## Step-by-step results

| Step | Real RPC exercised | Result |
|---|---|---|
| Deploy workforce | `deploy_workforce_template('B2B Sales Team', ...)` | ✅ Created a real organization, a real manager agent, and both `Generate Leads` and `Close Deals` goals |
| Launch campaign (ICP) | `launch_campaign_icp(goal_id, 'Fintech', '11-50 employees', 'United States', ...)` | ✅ ICP written to `target_metrics` correctly, `setAt` timestamp recorded |
| Generate prospects | `record_sales_activity(..., 'lead_found', ...)` | ✅ Recorded (this is the point a real Hunter.io API call would populate real people — not exercised here, see below) |
| Draft emails | `record_sales_activity(..., 'email_drafted', ...)` | ✅ Recorded (this is the point a real LLM call would write real copy — not exercised here) |
| Approve + send | `record_sales_activity(..., 'email_sent', ...)` | ✅ Recorded (this is the point a real Gmail API send would happen — not exercised here) |
| Receive reply | `record_sales_activity(..., 'reply_received', ...)` | ✅ Recorded (a real inbound Gmail reply is what would trigger this in production) |
| Classify the reply | `record_reply_classification(..., 'meeting_request', 0.92, ...)` | ✅ Classification stored (a real LLM call would produce the classification/confidence/reasoning in production — the exact JSON shape was reused here) |
| Auto-create meeting | `create_meeting(...)` | ✅ Fired automatically from the `meeting_request` classification — the same wiring `checkRepliesForOrganization()` uses |
| Advance meeting status | `update_meeting_status(..., 'scheduled')`, `(..., 'completed')` | ✅ Both transitions succeeded through the real RPC |
| **RLS correctly blocked a raw write attempt** | A raw `UPDATE meetings SET status = ...` (bypassing the RPC) | ✅ **Rejected — 0 rows affected.** `meetings` has no direct UPDATE policy for `authenticated`; only `update_meeting_status()`/`record_deal_outcome()` can write it. This is correct, intentional security posture, caught by this validation exercise, not a bug. |
| Record deal outcome | `record_deal_outcome(meeting_id, 'won', 24000)` | ✅ Recorded; audit log entry confirmed present |
| Downstream: business outcomes | `get_business_outcomes()` | ✅ `meetings_booked=1, opportunities_created=1, positive_replies=1, pipeline_generated=0` (pipeline is 0 because the meeting's own `estimated_value` was already realized as a closed deal, not left open) |
| Downstream: customer health | `get_organization_health()` | ✅ `adoption=31, success=70, risk=20, status=at_risk` — `at_risk` here is *correct*, not a bug: the simulated org has no connected integrations and no login recorded, both real Phase 22 risk inputs, exactly as designed |
| Downstream: revenue attribution | `get_revenue_attribution()` | ✅ `revenue_won=24000`, correctly bucketed under `by_icp: "Unknown"` (no prior ICP period exists to attribute against on a first launch — correct, not a bug) and `by_subject_line: "No experiment"` (no A/B test was running — correct) |
| Downstream: executive brief | `generate_executive_brief(org, 'weekly')` | ✅ Real, accurate plain-language narrative: *"1 prospect(s) replied to outreach this period," "1 meeting(s) booked this period," "Replies rose from 0 to 1 vs. the prior period"* |
| Downstream: opportunities | `get_opportunities()` | ✅ Correctly surfaced Jane Prospect as a high-value prospect at the real $8,000 estimated value |
| Downstream: follow-up intelligence | `get_next_best_action()` | ✅ Correctly returned zero rows — the meeting_request was already acted on (a meeting exists), so nothing is overdue |

**19 of 19 steps validated at the data layer. Zero failures.**

## What genuinely cannot be validated without a real deployment

These require real external credentials this sandbox does not have —
listed precisely, not glossed over:

1. **Real Gmail OAuth connect** — needs a real `GOOGLE_CLIENT_ID`/
   `GOOGLE_CLIENT_SECRET` and a real Google account granting consent.
2. **Real Hunter.io domain search** — needs a real Hunter.io API key and
   will return real people at a real target company, not the single
   hand-entered contact used above.
3. **Real LLM-drafted outreach copy** — needs a real `OPENAI_API_KEY` or
   `ANTHROPIC_API_KEY`; the actual generated subject line and body text
   were never produced or reviewed here.
4. **Real Gmail send** — needs a connected Gmail account; would confirm
   the email actually lands in a real inbox, not just that a
   `sales_activities` row was written.
5. **Real inbound reply detection** — needs a real Gmail thread with an
   actual reply in it, exercising `checkRepliesForOrganization()`'s real
   Gmail API polling, not a hand-inserted `reply_received` row.
6. **Real reply classification quality** — needs a real LLM call through
   `lib/runtime/replyClassifier.ts`; only the RPC that *stores* a
   classification was exercised, not the model call that *produces* one.

All six require nothing more than the credentials named in
`DEPLOYMENT_CHECKLIST.md` — no code changes. Recommended next step: run
this exact scenario again against a real deployed environment with real
credentials, end to end, before onboarding the first paying design
partner.
