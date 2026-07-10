#!/usr/bin/env bash
# Regression script for the RLS/RPC paths that matter most: job queue
# system-only functions, reply classification, deal outcomes/revenue
# attribution, and the audit log — plus the is_system_caller() bypass
# those all depend on. Every check runs as a real Postgres role
# (authenticated/service_role/anon) with real request.jwt.claim.* GUCs
# set, the same two things Supabase's PostgREST sets on every request, so
# a pass here means the RLS policies and SECURITY DEFINER checks actually
# hold — not just that the calling code happened to behave.
#
# Usage: ./scripts/test_critical_paths.sh
# Requires a reachable Postgres 16+ server and CREATE DATABASE privileges
# on it. Defaults assume a local server reachable as the `postgres` user
# with no password (peer auth, or PGPASSWORD already exported); override
# via the standard PGHOST/PGPORT/PGUSER/PGPASSWORD env vars.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DB="${TEST_DB:-ai_workforce_critical_test}"
# Left unset by default so psql connects over the local Unix socket (peer
# auth) — the friendliest default for a bare local Postgres install. Set
# PGHOST explicitly (e.g. 127.0.0.1) if your server requires TCP.
[ -n "${PGHOST:-}" ] && export PGHOST
[ -n "${PGPORT:-}" ] && export PGPORT
export PGUSER="${PGUSER:-postgres}"

OWNER_ID="11111111-1111-1111-1111-111111111111"
OUTSIDER_ID="22222222-2222-2222-2222-222222222222"
ADMIN_ID="33333333-3333-3333-3333-333333333333"
MEMBER_ID="44444444-4444-4444-4444-444444444444"
ORG_ID="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
MEETING_ID="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

TOTAL=0
PASSED=0
FAILED_LABELS=()

log() { echo "$@" >&2; }

# Runs SQL as a given Postgres role with the given JWT-style GUCs set,
# mirroring exactly what PostgREST sets per-request in real Supabase.
run_sql() {
  local pgrole="$1" sub="$2" jwtrole="$3" body="$4"
  {
    echo "set role ${pgrole};"
    [ -n "$sub" ] && echo "set request.jwt.claim.sub = '${sub}';"
    [ -n "$jwtrole" ] && echo "set request.jwt.claim.role = '${jwtrole}';"
    echo "$body"
  } | psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" 2>&1
}

check() {
  local label="$1"
  TOTAL=$((TOTAL + 1))
  if "${@:2}"; then
    log "PASS: $label"
    PASSED=$((PASSED + 1))
  else
    log "FAIL: $label"
    FAILED_LABELS+=("$label")
  fi
}

expect_success() {
  run_sql "$1" "$2" "$3" "$4" >/tmp/critical_path_last_output.txt
}

expect_failure() {
  local expect_substr="${5:-}"
  local out rc=0
  out=$(run_sql "$1" "$2" "$3" "$4") || rc=$?
  echo "$out" >/tmp/critical_path_last_output.txt
  if [ "$rc" -eq 0 ]; then return 1; fi
  if [ -n "$expect_substr" ] && ! echo "$out" | grep -qi "$expect_substr"; then
    log "  expected error containing '$expect_substr', got: $out"
    return 1
  fi
  return 0
}

expect_value() {
  local expected="$5"
  local out rc=0
  out=$(run_sql "$1" "$2" "$3" "$4") || rc=$?
  echo "$out" >/tmp/critical_path_last_output.txt
  # Only the LAST statement's output is the actual assertion — earlier
  # statements in a multi-statement body (e.g. a void side-effecting call
  # like record_login()) still run and still print their own (often
  # empty) output line, which must not be compared against $expected.
  local last_line
  last_line=$(echo "$out" | tail -n1)
  [ "$rc" -eq 0 ] && [ "$last_line" = "$expected" ]
}

on_fail_show_output() {
  if [ "$1" -ne 0 ]; then cat /tmp/critical_path_last_output.txt >&2; fi
}

log "Recreating $DB from scratch..."
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists \"$DB\";"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database \"$DB\";"

log "Bootstrapping auth schema + roles (before migrations, matching real Supabase grant timing)..."
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/sql/bootstrap_test_auth.sql

log "Applying migrations 001-021 in order..."
for f in supabase/migrations/[0-9]*.sql; do
  log "  -> $f"
  psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done

log "Loading fixture (owner/outsider/admin profiles, one org, one meeting)..."
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/sql/critical_path_fixture.sql

log ""
log "Running checks..."
log ""

# --- is_system_caller() sanity ---------------------------------------------
check "is_system_caller() is false for an authenticated user" \
  expect_value authenticated "$OWNER_ID" authenticated "select public.is_system_caller();" "f"
check "is_system_caller() is true for service_role" \
  expect_value service_role "" service_role "select public.is_system_caller();" "t"

# --- Job queue ---------------------------------------------------------------
check "owner can enqueue_job for their own org" \
  expect_success authenticated "$OWNER_ID" authenticated \
  "select * from public.enqueue_job('$ORG_ID', 'check_replies');"
check "outsider cannot enqueue_job for someone else's org" \
  expect_failure authenticated "$OUTSIDER_ID" authenticated \
  "select public.enqueue_job('$ORG_ID', 'check_replies');" "not authorized"
check "authenticated role is denied claim_next_jobs_system at the Postgres level (not just app-level)" \
  expect_failure authenticated "$OWNER_ID" authenticated \
  "select * from public.claim_next_jobs_system(5);" "permission denied"
check "service_role can claim_next_jobs_system" \
  expect_success service_role "" service_role \
  "select count(*) from public.claim_next_jobs_system(5);"
check "service_role can run a job through start/complete" \
  expect_success service_role "" service_role "
    with job as (select id from public.job_queue where organization_id = '$ORG_ID' and status = 'running' limit 1),
    run as (select (public.start_job_run_system((select id from job))).id as run_id)
    select public.complete_job_system((select id from job), (select run_id from run), '{}'::jsonb);
  "

# --- Reply classification + meeting detection ---------------------------------
check "owner can record_reply_classification" \
  expect_success authenticated "$OWNER_ID" authenticated "
    select * from public.record_reply_classification(
      '$ORG_ID', null, 'prospect@example.com', 'Prospect Person', 'interested', 0.9, 'test fixture', '[]'::jsonb
    );
  "
check "outsider cannot record_reply_classification for someone else's org" \
  expect_failure authenticated "$OUTSIDER_ID" authenticated "
    select public.record_reply_classification(
      '$ORG_ID', null, 'prospect@example.com', 'Prospect Person', 'interested', 0.9, 'test fixture', '[]'::jsonb
    );
  " "not authorized"
check "service_role can record_reply_classification with no user session" \
  expect_success service_role "" service_role "
    select * from public.record_reply_classification(
      '$ORG_ID', null, 'prospect2@example.com', 'Second Prospect', 'objection', 0.7, 'test fixture', '[]'::jsonb
    );
  "
check "outsider cannot see reply_classifications for someone else's org (RLS)" \
  expect_value authenticated "$OUTSIDER_ID" authenticated \
  "select count(*) from public.reply_classifications where organization_id = '$ORG_ID';" "0"
check "owner can see reply_classifications for their own org (RLS)" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select count(*) > 0 from public.reply_classifications where organization_id = '$ORG_ID';" "t"

# --- Revenue operating system ---------------------------------------------
check "owner can record_deal_outcome on their own meeting" \
  expect_success authenticated "$OWNER_ID" authenticated \
  "select public.record_deal_outcome('$MEETING_ID', 'won', 7500);"
check "outsider cannot record_deal_outcome on someone else's meeting" \
  expect_failure authenticated "$OUTSIDER_ID" authenticated \
  "select public.record_deal_outcome('$MEETING_ID', 'lost', 100);" "not authorized"
check "get_revenue_attribution reflects the recorded won deal" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select (public.get_revenue_attribution('$ORG_ID')->>'revenue_won')::numeric;" "7500.00"

# --- Audit log ---------------------------------------------------------------
check "recording a deal outcome writes an audit_log entry" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select count(*) > 0 from public.audit_log where organization_id = '$ORG_ID' and action = 'deal_outcome_recorded';" "t"
check "outsider cannot see audit_log entries for someone else's org (RLS)" \
  expect_value authenticated "$OUTSIDER_ID" authenticated \
  "select count(*) from public.audit_log where organization_id = '$ORG_ID';" "0"
check "org owner (as manager) can see their own org's audit_log" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select count(*) > 0 from public.audit_log where organization_id = '$ORG_ID';" "t"
check "platform admin can see any org's audit_log" \
  expect_value authenticated "$ADMIN_ID" authenticated \
  "select count(*) > 0 from public.audit_log where organization_id = '$ORG_ID';" "t"

# --- Phase 22: login tracking, feedback triage, support RLS, partner funnel ---
check "record_login() increments login_count on first call" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select public.record_login(); select login_count from public.profiles where id = '$OWNER_ID';" "1"
check "record_login() does not double-count within the 30-minute window" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select public.record_login(); select public.record_login(); select login_count from public.profiles where id = '$OWNER_ID';" "1"
check "non-admin cannot call get_partner_funnel" \
  expect_failure authenticated "$OWNER_ID" authenticated \
  "select * from public.get_partner_funnel();" "not authorized"
check "admin can call get_partner_funnel" \
  expect_success authenticated "$ADMIN_ID" authenticated \
  "select * from public.get_partner_funnel();"
check "non-admin cannot triage_feedback" \
  expect_failure authenticated "$OWNER_ID" authenticated "
    insert into public.user_feedback (user_id, feedback_type, message) values ('$OWNER_ID', 'bug', 'critical path test bug');
    select public.triage_feedback((select id from public.user_feedback where user_id = '$OWNER_ID' order by created_at desc limit 1), 'in_progress', 'high', null);
  " "not authorized"
check "admin can triage_feedback and bump_feedback_frequency" \
  expect_value authenticated "$ADMIN_ID" authenticated "
    select public.triage_feedback((select id from public.user_feedback where user_id = '$OWNER_ID' order by created_at desc limit 1), 'in_progress', 'high', '$ADMIN_ID');
    select public.bump_feedback_frequency((select id from public.user_feedback where user_id = '$OWNER_ID' order by created_at desc limit 1));
    select frequency from public.user_feedback where user_id = '$OWNER_ID' order by created_at desc limit 1;
  " "2"
check "org owner can see a support conversation filed by a different org member (widened RLS)" \
  expect_value authenticated "$OWNER_ID" authenticated \
  "select count(*) > 0 from public.support_conversations where organization_id = '$ORG_ID' and user_id = '$MEMBER_ID';" "t"
check "true outsider still cannot see the org's support conversations" \
  expect_value authenticated "$OUTSIDER_ID" authenticated \
  "select count(*) from public.support_conversations where organization_id = '$ORG_ID';" "0"

log ""
log "----------------------------------------"
log "$PASSED / $TOTAL checks passed"
if [ "${#FAILED_LABELS[@]}" -gt 0 ]; then
  log "Failed:"
  for l in "${FAILED_LABELS[@]}"; do log "  - $l"; done
  exit 1
fi
log "All critical paths verified against a fresh Postgres 16 instance."
