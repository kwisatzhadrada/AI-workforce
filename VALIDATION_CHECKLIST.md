# Real-World Validation Checklist

Pre-flight checks before pointing a stabilized deployment at a real Gmail
account, a real HubSpot portal, and a real Hunter.io account. This is the
sequel to `DEPLOYMENT_GUIDE.md` (which covers *how* to connect each
integration) — this document covers *what to verify is actually working*
before trusting the pipeline with a real prospect's inbox.

Every item below was added or confirmed during Stabilization Sprint 1,
against a real local Postgres 16 instance (not a service-role bypass —
every check ran `set role authenticated` as an actual org member, and
separately as an unrelated outsider, to confirm both access and denial).

---

## 1. Database

- [ ] Migrations `001` through `014` are applied, in order, with no skips.
      `014_stabilization.sql` is not optional — it contains the fixes below.
- [ ] `agent_executions.integration_action` column exists, and the partial
      unique index `agent_executions_one_completed_action_per_task` exists
      on `(task_id, integration_action)`. Confirm with:
      ```sql
      select indexname from pg_indexes
      where tablename = 'agent_executions'
        and indexname = 'agent_executions_one_completed_action_per_task';
      ```
- [ ] `capability_matches_task()` exists and returns `true` for your
      deployed template's own capability/task-title pairs, e.g.:
      ```sql
      select capability_matches_task('Prospect Research', 'Research Prospect'); -- expect true
      ```
- [ ] `deploy_workforce_template()` is `security definer`. This sprint found
      it previously wasn't — meaning every template deployment failed for a
      real (non-service-role) user with "permission denied for function
      increment_template_usage". Confirm with:
      ```sql
      select prosecdef from pg_proc where proname = 'deploy_workforce_template'; -- expect t
      ```
- [ ] **Do not** test any of the above with a service-role key, or with a
      blanket `grant execute on all functions ... to authenticated` run
      against your test database. Both mask real permission bugs — this
      sprint found two real ones (the `deploy_workforce_template` gap above,
      and the wallet-balance-vs-assignment issue in section 3) specifically
      *because* testing used the actual `authenticated` role with only the
      grants the migrations themselves create.

## 2. Deploy a real test organization

- [ ] Deploy the B2B Sales Team template as a real logged-in user (not an
      admin, not a service role) — this exercises the exact path a real
      customer will use.
- [ ] Confirm all 4 agents exist (Lead Research Agent, Sales Agent, Outreach
      Agent, CRM Agent) and each has exactly one enabled capability with the
      right `integration_action` (`prospect_enrich` / — / `email_draft_send`
      / `crm_upsert`).

## 3. Assignment correctness

- [ ] Create (or accept an AI-drafted) a goal plan with steps titled
      "Research Prospect", "Outreach", and "Update CRM" (or any title that
      shares real words with the matching capability's name — the matcher
      is word-overlap based, not exact-string).
- [ ] Approve the plan and confirm each task's `assigned_agent_id` lands on
      the *correct* agent — Lead Research Agent for prospecting, Outreach
      Agent for outreach, CRM Agent for the CRM step. Check the `/diagnostics`
      page's Assignment Decisions panel: each row should say "capability
      match", not "fallback".
- [ ] **Known interaction to be aware of, not a bug to fix per-deployment:**
      every agent's wallet starts at $0 (`agent_wallets.balance` default).
      Assignment itself is no longer gated on wallet balance (fixed this
      sprint — a $0 wallet used to make the *correctly matched* agent lose
      to an unrelated one that happened to be "free"). But **execution**
      still is: if you fund an agent's wallet, its own paid capability will
      debit on completion; if you don't, the capability that would cost
      money still runs at execution time. Fund the wallet if you want cost
      tracking; assignment correctness does not depend on it.

## 4. Execution safety

- [ ] Manually run an execution for the "Research Prospect" task's
      Prospect Research capability twice in a row (click Run Execution,
      let it finish, click it again). The second attempt must fail with a
      message like "has already run (or is currently running) for this
      task" — not silently double-enrich, not double-send an email, not
      double-create a CRM contact.
- [ ] Confirm the block is a real database constraint, not just a UI
      disable: re-running the same insert directly against Postgres for a
      `completed`/`queued`/`running` row with the same
      `(task_id, integration_action)` must raise `23505 unique_violation`.
- [ ] Confirm a genuinely **failed** execution (e.g. temporarily disconnect
      the integration first) can still be retried — the unique index
      deliberately excludes `status = 'failed'`.
- [ ] For HubSpot specifically: if the same contact email is enriched twice
      across two different tasks (e.g. two organizations both found the
      same lead), confirm `createContact` recovers via the 409-conflict
      fallback (reuses the existing HubSpot contact ID) rather than
      erroring the whole execution.

## 5. Integrations

- [ ] Connect Gmail via real OAuth (Testing-mode consent screen, your
      account added as a test user). Confirm `?connected=gmail` appears
      after the redirect.
- [ ] Connect HubSpot with a real Private App token
      (`crm.objects.contacts.read`/`.write` scopes).
- [ ] Connect Hunter.io with a real API key.
- [ ] Disconnect and reconnect each one; confirm `/diagnostics` →
      Integration History shows `connected` / `disconnected` events with
      correct timestamps.
- [ ] Force a real integration failure (e.g. temporarily revoke the HubSpot
      token in HubSpot's UI, then run a CRM Sync execution). Confirm:
      the execution fails with a clear message, **and**
      `organization_integrations.status` flips to `'error'` with a real
      `last_error`, **and** it shows up in `/diagnostics` → Integration
      History as an `integration_error` event. This is new this sprint —
      previously `record_integration_error()` existed but nothing ever
      called it.

## 6. Observability

- [ ] `/diagnostics` (admin-only) loads and shows real data across all
      five panels: Assignment Decisions, Execution History, Recent
      Failures, Retries, Integration History.
- [ ] Confirm a non-admin account gets redirected away from `/diagnostics`,
      and that calling `get_execution_history` (or any of the other four
      diagnostics RPCs) directly as a non-admin raises `not authorized`.

## 7. End-to-end campaign

- [ ] Provide 2-3 real target company domains you actually control or have
      permission to test against (or your own domain / a colleague's,
      with consent — Hunter.io returns real people's real emails).
- [ ] Run Prospect Research → confirm real leads appear in Sales Pipeline
      and `sales_activities` (`lead_found` rows).
- [ ] Run Outreach Send → confirm a real email actually lands in the
      recipient's inbox (check a test inbox you control), and
      `email_sent` activities are recorded.
- [ ] Run CRM Sync → confirm the contact actually appears in HubSpot with
      a note referencing the sent email.
- [ ] Click Check Replies after a real reply → confirm `reply_received` is
      recorded and, if HubSpot is connected, a note is logged there too.
- [ ] Log a meeting manually once one is actually booked.
- [ ] Sales Pipeline tab's four counters (Leads Found / Emails Sent /
      Replies Received / Meetings Booked) match what actually happened —
      not a fabricated or rounded number.

---

If any item above fails, it's a real defect, not an environment quirk —
every check here was written against something that either broke or was
silently unverified before this sprint. File it the same way the two bugs
in `RELIABILITY_REPORT.md` were found: reproduce against a real Postgres
role, not a service-role shortcut.
