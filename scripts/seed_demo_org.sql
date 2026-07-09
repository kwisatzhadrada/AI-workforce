-- ============================================================
-- Demo environment seed script
-- ============================================================
-- Creates a real demo organization, a real deployed B2B Sales Team
-- workforce, and a real campaign structure (goal + plan + tasks) ready
-- to run against real Gmail/Hunter.io/HubSpot accounts once connected.
--
-- This does NOT fabricate business outcomes. No sales_activities rows
-- (leads found, emails sent, replies, meetings) are inserted here — those
-- only ever come from actually running the pipeline against real
-- integrations, exactly as DEMO_GUIDE.md describes. What this script
-- automates is the tedious setup typing (org + workforce + campaign
-- structure), not the results.
--
-- HOW TO RUN:
-- 1. Sign up a real demo user account through the app (or reuse an
--    existing one) — this script needs that user's real auth.uid(),
--    since every write in this codebase goes through the RLS-checked
--    session of a real user, not a service-role key.
-- 2. In the Supabase SQL editor (or psql against your project), find
--    that user's id:
--      select id, email from auth.users where email = 'demo@yourcompany.com';
-- 3. Replace DEMO_USER_ID below with that real uuid, then run this whole
--    script. It prints the new organization id at the end.
-- 4. Connect real Gmail/Hunter.io/HubSpot for the new demo organization
--    from its Integrations tab (or /onboarding), then walk the Campaign
--    Dashboard live — see DEMO_GUIDE.md for the full live-demo script.
-- ============================================================

do $$
declare
  -- Left as literal text on purpose: if you run this without replacing
  -- it, the DECLARE below fails immediately with a plain Postgres
  -- "invalid input syntax for type uuid" error — a clearer signal than a
  -- custom guard, and one that can't be silently defeated by a
  -- find-replace of this same placeholder token also rewriting a
  -- separate check.
  v_demo_user_id uuid := 'DEMO_USER_ID';  -- <-- replace before running
  v_template_id uuid;
  v_org_id uuid;
  v_goal_id uuid;
  v_plan_id uuid;
begin
  select id into v_template_id from public.workforce_templates where name = 'B2B Sales Team';
  if v_template_id is null then
    raise exception 'B2B Sales Team template not found — has 010_workforce_template_seeds.sql been applied?';
  end if;

  -- Run as the real demo user, same as every other write in this app —
  -- this is what makes deploy_workforce_template()'s auth.uid() calls
  -- attribute ownership correctly.
  perform set_config('request.jwt.claim.sub', v_demo_user_id::text, true);

  v_org_id := public.deploy_workforce_template(v_template_id, 'Acme Demo Co', 'B2B SaaS');
  raise notice 'Demo organization created: %', v_org_id;

  select id, manager_agent_id into v_goal_id from public.organization_goals
    where organization_id = v_org_id and title = 'Generate Leads';

  insert into public.goal_plans (goal_id, status, generated_by, created_by)
  values (v_goal_id, 'draft', 'human', v_demo_user_id)
  returning id into v_plan_id;

  -- Sample-labeled placeholder domains — replace with real target
  -- companies (or connect Hunter.io and use the guided campaign form's
  -- AI-suggestion path) before actually enriching for a live demo.
  insert into public.goal_plan_steps (plan_id, step_order, title, description)
  values
    (v_plan_id, 1, 'Research Prospect', 'Enrich target market: example.com, example.org (SAMPLE domains — replace with real target companies before running). Context: Fintech · 51-200 employees · United States.'),
    (v_plan_id, 2, 'Outreach', 'Series A-C fintech companies building payments infrastructure, whose engineering leaders care about developer experience.'),
    (v_plan_id, 3, 'Update CRM', 'Sync contacted leads into the CRM');

  perform public.approve_goal_plan(v_plan_id);
  perform public.record_campaign_launched(v_org_id, jsonb_build_object('demo', true));

  raise notice 'Demo campaign created for organization %. Visit /organizations/%?tab=campaign once integrations are connected.', v_org_id, v_org_id;
end $$;
