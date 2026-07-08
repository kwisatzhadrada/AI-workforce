import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgentBlueprint, GoalBlueprint, TemplateMetrics, WorkflowBlueprint } from '@/lib/types'
import { getAssignmentPriorityColor } from '@/lib/utils'
import DeployTemplateForm from '@/components/templates/DeployTemplateForm'
import TemplateMetricsPanel from '@/components/templates/TemplateMetricsPanel'

export const dynamic = 'force-dynamic'

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: template } = await supabase.from('workforce_templates').select('*').eq('id', id).maybeSingle()
  if (!template) notFound()

  const [{ data: agentBlueprints }, { data: workflowBlueprints }, { data: goalBlueprints }, { data: metrics }] = await Promise.all([
    supabase.from('agent_blueprints').select('*').eq('template_id', id).order('created_at'),
    supabase.from('workflow_blueprints').select('*, workflow_blueprint_steps(*, agent_blueprints(id, name))').eq('template_id', id),
    supabase.from('goal_blueprints').select('*, agent_blueprints(id, name)').eq('template_id', id),
    supabase.rpc('get_template_metrics', { p_template_id: id }).single(),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">{template.name}</h1>
          {template.industry && <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{template.industry}</span>}
        </div>
        {template.description && <p className="text-[#EDEAF8] text-sm leading-relaxed mb-2">{template.description}</p>}
        {template.goal && <p className="text-sm text-[#8B5CF6]">🎯 {template.goal}</p>}
      </div>

      <TemplateMetricsPanel metrics={metrics as TemplateMetrics | null} />

      <DeployTemplateForm templateId={id} templateName={template.name} defaultIndustry={template.industry} />

      <div className="mt-6">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Agents ({(agentBlueprints || []).length})</h2>
        <div className="space-y-3">
          {((agentBlueprints as AgentBlueprint[]) || []).map((a) => (
            <div key={a.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm text-[#EDEAF8]">{a.name}</span>
                {a.is_manager && <span className="text-xs px-2 py-0.5 rounded-md border text-purple-300 bg-purple-500/15 border-purple-500/30">manager</span>}
                {a.department_slug && <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8] capitalize">{a.department_slug}</span>}
              </div>
              {a.description && <p className="text-xs text-[#8A88A8] mb-2">{a.description}</p>}
              {a.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {a.capabilities.map((c) => (
                    <span key={c.name} className="text-xs px-2 py-0.5 rounded-md bg-[#6D28D9]/10 border border-[#6D28D9]/30 text-[#C4B5FD]">{c.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {((workflowBlueprints as WorkflowBlueprint[]) || []).length > 0 && (
        <div className="mt-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Workflow</h2>
          {(workflowBlueprints as WorkflowBlueprint[]).map((wf) => (
            <div key={wf.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-4 mb-3">
              <div className="font-medium text-sm text-[#EDEAF8] mb-2">{wf.name}</div>
              <div className="flex items-center gap-2 flex-wrap">
                {(wf.workflow_blueprint_steps || []).slice().sort((x, y) => x.step_order - y.step_order).map((s, i, arr) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-[#121428] border border-[#3C3A58] text-[#EDEAF8]">
                      {s.step_order}. {s.name}
                      {s.agent_blueprints && <span className="text-[#8A88A8]"> · {s.agent_blueprints.name}</span>}
                    </span>
                    {i < arr.length - 1 && <span className="text-[#3C3A58]">→</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {((goalBlueprints as GoalBlueprint[]) || []).length > 0 && (
        <div className="mt-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Goals</h2>
          <div className="space-y-3">
            {(goalBlueprints as GoalBlueprint[]).map((g) => (
              <div key={g.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm text-[#EDEAF8]">{g.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(g.priority)}`}>{g.priority}</span>
                </div>
                {g.description && <p className="text-xs text-[#8A88A8] mb-2">{g.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(g.target_metrics || {}).map(([k, v]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                      {k}: <span className="text-[#EDEAF8] font-medium">{String(v)}</span>
                    </span>
                  ))}
                  {g.agent_blueprints && <span className="text-xs text-[#8A88A8]">Manager: {g.agent_blueprints.name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
