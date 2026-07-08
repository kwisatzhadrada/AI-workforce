-- ============================================================
-- Workforce Template Seeds (Phase 7)
-- Five system templates, each a real, deployable organization
-- blueprint: agents with capabilities/prompts/memory defaults, a
-- workflow, and goals. created_by is left null (system-provided,
-- editable by no one through the app — matches the "examples" the
-- spec names).
-- ============================================================

do $$
declare
  v_template_id uuid;
  v_research_agent uuid;
  v_sales_agent uuid;
  v_outreach_agent uuid;
  v_followup_agent uuid;
  v_workflow_id uuid;
begin
  -- ============================================================
  -- 1. B2B Sales Team
  -- ============================================================
  insert into public.workforce_templates (name, description, industry, goal, configuration)
  values (
    'B2B Sales Team',
    'A complete outbound sales motion: research prospects, qualify them, run outreach, and follow up — end to end.',
    'B2B SaaS',
    'Generate and close qualified B2B leads',
    jsonb_build_object('departments', array['research', 'sales'])
  )
  returning id into v_template_id;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Lead Research Agent',
    'Researches target companies and decision-makers before outreach begins.',
    'You are a meticulous B2B research analyst. Given a target company or persona profile, identify decision-makers, company context, and buying signals. Be concise and cite what you find.',
    jsonb_build_array(jsonb_build_object('name', 'Research', 'description', 'Research prospect companies and decision-makers', 'cost_estimate', 0.5)),
    jsonb_build_array(jsonb_build_object('memory_type', 'context', 'key', 'research_focus', 'value', jsonb_build_object('text', 'B2B SaaS buyers, 50-500 employee companies'))),
    'Research Prospect', 'research', false
  )
  returning id into v_research_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Sales Agent',
    'Qualifies researched prospects and owns the sales goal end to end.',
    'You are a persuasive, consultative B2B sales rep. Qualify inbound research against BANT criteria and decide whether a prospect is worth pursuing.',
    jsonb_build_array(jsonb_build_object('name', 'Lead Generation', 'description', 'Qualify prospects against ideal customer profile', 'cost_estimate', 1)),
    jsonb_build_array(jsonb_build_object('memory_type', 'preference', 'key', 'qualification_criteria', 'value', jsonb_build_object('text', 'BANT: Budget, Authority, Need, Timeline'))),
    'Qualify Prospect', 'sales', true
  )
  returning id into v_sales_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Outreach Agent',
    'Drafts and sends outbound outreach to qualified prospects.',
    'You are a warm, concise outbound copywriter. Draft outreach that references specific research findings rather than generic templates.',
    jsonb_build_array(jsonb_build_object('name', 'Writing', 'description', 'Draft personalized outbound emails', 'cost_estimate', 0.5)),
    '[]'::jsonb,
    'Outreach', 'sales', false
  )
  returning id into v_outreach_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Follow-up Agent',
    'Tracks responses and keeps the conversation moving until a decision.',
    'You track outbound threads, summarize prospect responses, and draft timely follow-ups that move the deal forward without being pushy.',
    jsonb_build_array(jsonb_build_object('name', 'Customer Support', 'description', 'Track responses and follow up', 'cost_estimate', 0.5)),
    '[]'::jsonb,
    'Follow-up', 'sales', false
  )
  returning id into v_followup_agent;

  insert into public.workflow_blueprints (template_id, name, description)
  values (v_template_id, 'Lead Generation Workflow', 'Research Prospect -> Qualify Prospect -> Outreach -> Follow-up')
  returning id into v_workflow_id;

  insert into public.workflow_blueprint_steps (workflow_blueprint_id, step_order, name, agent_blueprint_id, department_slug) values
    (v_workflow_id, 1, 'Research Prospect', v_research_agent, 'research'),
    (v_workflow_id, 2, 'Qualify Prospect', v_sales_agent, 'sales'),
    (v_workflow_id, 3, 'Outreach', v_outreach_agent, 'sales'),
    (v_workflow_id, 4, 'Follow-up', v_followup_agent, 'sales');

  insert into public.goal_blueprints (template_id, title, description, priority, target_metrics, manager_agent_blueprint_id) values
    (v_template_id, 'Generate Leads', 'Build a pipeline of qualified B2B leads ready for outreach.', 'high', jsonb_build_object('leads', 100), v_sales_agent),
    (v_template_id, 'Close Deals', 'Convert qualified pipeline into closed-won revenue.', 'critical', jsonb_build_object('deals_closed', 10), v_sales_agent);

  -- ============================================================
  -- 2. Customer Support Team
  -- ============================================================
  insert into public.workforce_templates (name, description, industry, goal, configuration)
  values (
    'Customer Support Team',
    'Triages, resolves, and escalates support tickets with a consistent quality bar.',
    'SaaS / Customer Success',
    'Answer support tickets quickly and correctly',
    jsonb_build_object('departments', array['support'])
  )
  returning id into v_template_id;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Triage Agent', 'Classifies incoming tickets by urgency and topic.',
    'You triage support tickets: classify urgency, topic, and whether the customer is at risk of churning. Be fast and consistent.',
    jsonb_build_array(jsonb_build_object('name', 'Customer Support', 'description', 'Classify and prioritize incoming tickets', 'cost_estimate', 0.25)),
    '[]'::jsonb, 'Triage Ticket', 'support', false
  ) returning id into v_research_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Resolution Agent', 'Resolves the majority of tickets directly and owns the support goal.',
    'You are a knowledgeable, empathetic support agent. Resolve tickets using documented product knowledge; be clear about what you did and why.',
    jsonb_build_array(jsonb_build_object('name', 'Customer Support', 'description', 'Resolve tickets end to end', 'cost_estimate', 0.5)),
    jsonb_build_array(jsonb_build_object('memory_type', 'preference', 'key', 'tone', 'value', jsonb_build_object('text', 'Warm, direct, no corporate filler'))),
    'Resolve Ticket', 'support', true
  ) returning id into v_sales_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Escalation Agent', 'Handles tickets that need specialist or human escalation.',
    'You handle escalated tickets that the resolution agent could not close: identify the specific blocker and prepare a clear handoff.',
    jsonb_build_array(jsonb_build_object('name', 'Customer Support', 'description', 'Handle complex escalations', 'cost_estimate', 0.75)),
    '[]'::jsonb, 'Escalate if Needed', 'support', false
  ) returning id into v_outreach_agent;

  insert into public.workflow_blueprints (template_id, name, description)
  values (v_template_id, 'Support Ticket Workflow', 'Triage Ticket -> Resolve Ticket -> Escalate if Needed -> Close Ticket')
  returning id into v_workflow_id;

  insert into public.workflow_blueprint_steps (workflow_blueprint_id, step_order, name, agent_blueprint_id, department_slug) values
    (v_workflow_id, 1, 'Triage Ticket', v_research_agent, 'support'),
    (v_workflow_id, 2, 'Resolve Ticket', v_sales_agent, 'support'),
    (v_workflow_id, 3, 'Escalate if Needed', v_outreach_agent, 'support'),
    (v_workflow_id, 4, 'Close Ticket', v_sales_agent, 'support');

  insert into public.goal_blueprints (template_id, title, description, priority, target_metrics, manager_agent_blueprint_id) values
    (v_template_id, 'Answer Support Tickets', 'Resolve incoming support volume within SLA and keep satisfaction high.', 'high', jsonb_build_object('tickets_resolved', 200, 'csat', 90), v_sales_agent);

  -- ============================================================
  -- 3. Research Team
  -- ============================================================
  insert into public.workforce_templates (name, description, industry, goal, configuration)
  values (
    'Research Team',
    'Gathers sources, analyzes data, and publishes findings on a topic or market.',
    'Market Research',
    'Deliver reliable, well-sourced research on demand',
    jsonb_build_object('departments', array['research'])
  )
  returning id into v_template_id;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Research Analyst', 'Gathers and vets sources, and owns the research goal.',
    'You are a rigorous research analyst. Gather primary and secondary sources, note credibility, and flag anything you could not verify.',
    jsonb_build_array(jsonb_build_object('name', 'Research', 'description', 'Gather and vet sources on a topic', 'cost_estimate', 0.75)),
    '[]'::jsonb, 'Gather Sources', 'research', true
  ) returning id into v_research_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Data Analyst', 'Analyzes gathered data for patterns and implications.',
    'You analyze research data for patterns, trends, and outliers. Quantify wherever the source material allows it.',
    jsonb_build_array(jsonb_build_object('name', 'Data Analysis', 'description', 'Analyze gathered research data', 'cost_estimate', 1)),
    '[]'::jsonb, 'Analyze Data', 'research', false
  ) returning id into v_sales_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Report Writer', 'Synthesizes findings into a clear final report.',
    'You turn analyzed research into a clear, well-structured report for a non-specialist audience. Lead with the takeaway.',
    jsonb_build_array(jsonb_build_object('name', 'Writing', 'description', 'Write up final research reports', 'cost_estimate', 0.5)),
    '[]'::jsonb, 'Publish Report', 'research', false
  ) returning id into v_outreach_agent;

  insert into public.workflow_blueprints (template_id, name, description)
  values (v_template_id, 'Research Workflow', 'Gather Sources -> Analyze Data -> Synthesize Findings -> Publish Report')
  returning id into v_workflow_id;

  insert into public.workflow_blueprint_steps (workflow_blueprint_id, step_order, name, agent_blueprint_id, department_slug) values
    (v_workflow_id, 1, 'Gather Sources', v_research_agent, 'research'),
    (v_workflow_id, 2, 'Analyze Data', v_sales_agent, 'research'),
    (v_workflow_id, 3, 'Synthesize Findings', v_sales_agent, 'research'),
    (v_workflow_id, 4, 'Publish Report', v_outreach_agent, 'research');

  insert into public.goal_blueprints (template_id, title, description, priority, target_metrics, manager_agent_blueprint_id) values
    (v_template_id, 'Deliver Research Insights', 'Produce a well-sourced research report on the target topic.', 'medium', jsonb_build_object('reports', 4), v_research_agent);

  -- ============================================================
  -- 4. Content Marketing Team
  -- ============================================================
  insert into public.workforce_templates (name, description, industry, goal, configuration)
  values (
    'Content Marketing Team',
    'Plans, drafts, edits, and publishes content on a recurring cadence.',
    'Marketing',
    'Create content that drives organic growth',
    jsonb_build_object('departments', array['marketing'])
  )
  returning id into v_template_id;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Content Strategist', 'Plans the content calendar and owns the content goal.',
    'You plan content that serves a clear audience need and business goal. Prioritize ideas by expected impact and effort.',
    jsonb_build_array(jsonb_build_object('name', 'Planning', 'description', 'Plan content calendar and topics', 'cost_estimate', 0.5)),
    '[]'::jsonb, 'Plan Content', 'marketing', true
  ) returning id into v_research_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Writer Agent', 'Drafts long-form and short-form content.',
    'You are a clear, engaging writer. Draft content against the brief exactly, avoiding filler and unearned superlatives.',
    jsonb_build_array(jsonb_build_object('name', 'Writing', 'description', 'Draft articles and content pieces', 'cost_estimate', 1)),
    '[]'::jsonb, 'Draft Content', 'marketing', false
  ) returning id into v_sales_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'SEO Agent', 'Optimizes drafts for search and publishes them.',
    'You review drafts for search intent match, structure, and internal linking opportunities before publication.',
    jsonb_build_array(jsonb_build_object('name', 'Research', 'description', 'Optimize content for search intent', 'cost_estimate', 0.5)),
    '[]'::jsonb, 'Edit & Optimize', 'marketing', false
  ) returning id into v_outreach_agent;

  insert into public.workflow_blueprints (template_id, name, description)
  values (v_template_id, 'Content Production Workflow', 'Plan Content -> Draft Content -> Edit & Optimize -> Publish')
  returning id into v_workflow_id;

  insert into public.workflow_blueprint_steps (workflow_blueprint_id, step_order, name, agent_blueprint_id, department_slug) values
    (v_workflow_id, 1, 'Plan Content', v_research_agent, 'marketing'),
    (v_workflow_id, 2, 'Draft Content', v_sales_agent, 'marketing'),
    (v_workflow_id, 3, 'Edit & Optimize', v_outreach_agent, 'marketing'),
    (v_workflow_id, 4, 'Publish', v_outreach_agent, 'marketing');

  insert into public.goal_blueprints (template_id, title, description, priority, target_metrics, manager_agent_blueprint_id) values
    (v_template_id, 'Create Content', 'Ship a steady cadence of published content.', 'medium', jsonb_build_object('articles', 20), v_research_agent);

  -- ============================================================
  -- 5. Recruiting Team
  -- ============================================================
  insert into public.workforce_templates (name, description, industry, goal, configuration)
  values (
    'Recruiting Team',
    'Sources, screens, and coordinates interviews for open roles.',
    'Human Resources',
    'Fill open roles with qualified candidates',
    jsonb_build_object('departments', array['operations'])
  )
  returning id into v_template_id;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Sourcing Agent', 'Finds candidates that match open role requirements.',
    'You source candidates against a role''s must-have requirements. Prioritize signal over resume keyword density.',
    jsonb_build_array(jsonb_build_object('name', 'Research', 'description', 'Source candidates matching role requirements', 'cost_estimate', 0.5)),
    '[]'::jsonb, 'Source Candidates', 'operations', false
  ) returning id into v_research_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Screening Agent', 'Screens sourced candidates and owns the hiring goal.',
    'You screen candidates against role requirements and communicate outcomes to candidates promptly and respectfully.',
    jsonb_build_array(jsonb_build_object('name', 'Customer Support', 'description', 'Screen candidates and manage candidate communication', 'cost_estimate', 0.5)),
    '[]'::jsonb, 'Screen Candidates', 'operations', true
  ) returning id into v_sales_agent;

  insert into public.agent_blueprints (template_id, name, description, default_prompt, capabilities, memory_defaults, workflow_role, department_slug, is_manager)
  values (
    v_template_id, 'Interview Coordinator Agent', 'Schedules interviews and prepares interviewers.',
    'You coordinate interview logistics: scheduling, reminders, and briefing interviewers on what to probe for.',
    jsonb_build_array(jsonb_build_object('name', 'Planning', 'description', 'Schedule interviews and prepare interviewers', 'cost_estimate', 0.25)),
    '[]'::jsonb, 'Schedule Interviews', 'operations', false
  ) returning id into v_outreach_agent;

  insert into public.workflow_blueprints (template_id, name, description)
  values (v_template_id, 'Recruiting Workflow', 'Source Candidates -> Screen Candidates -> Schedule Interviews -> Extend Offer')
  returning id into v_workflow_id;

  insert into public.workflow_blueprint_steps (workflow_blueprint_id, step_order, name, agent_blueprint_id, department_slug) values
    (v_workflow_id, 1, 'Source Candidates', v_research_agent, 'operations'),
    (v_workflow_id, 2, 'Screen Candidates', v_sales_agent, 'operations'),
    (v_workflow_id, 3, 'Schedule Interviews', v_outreach_agent, 'operations'),
    (v_workflow_id, 4, 'Extend Offer', v_sales_agent, 'operations');

  insert into public.goal_blueprints (template_id, title, description, priority, target_metrics, manager_agent_blueprint_id) values
    (v_template_id, 'Fill Open Roles', 'Move sourced candidates through to signed offers.', 'high', jsonb_build_object('hires', 5), v_sales_agent);
end $$;
