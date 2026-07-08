import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  detectAnomalies,
  findBestWorkflows,
  findWorstWorkflows,
  getAgentIntelligence,
  getExecutiveReports,
  getPredictions,
  getRecommendations,
  rankAgents,
  rankOrganizations,
  rankTemplates,
} from '@/lib/intelligence'
import { AgentProfileIntelligence, OrganizationHealth } from '@/lib/types'
import IntelligenceTabs from '@/components/intelligence/IntelligenceTabs'
import AgentIntelligenceList from '@/components/intelligence/AgentIntelligenceList'
import OrganizationIntelligenceList from '@/components/intelligence/OrganizationIntelligenceList'
import WorkflowIntelligenceLists from '@/components/intelligence/WorkflowIntelligenceLists'
import TemplateRankingList from '@/components/intelligence/TemplateRankingList'
import PredictionsList from '@/components/intelligence/PredictionsList'
import RecommendationCard from '@/components/intelligence/RecommendationCard'
import AnomaliesPanel from '@/components/intelligence/AnomaliesPanel'
import OrgScopedActionControl from '@/components/intelligence/OrgScopedActionControl'
import GenerateReportButton from '@/components/system-health/GenerateReportButton'
import ReportCard from '@/components/system-health/ReportCard'

export const dynamic = 'force-dynamic'

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const activeTab = tab || 'agents'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const { data: orgs } = await supabase.from('organizations').select('id, name').order('name').limit(200)
  const organizations = orgs || []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Workforce Intelligence</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          What the network has learned from its own operation — agent strengths and specializations, organization
          health, workflow performance, predictions, and recommendations a human can approve or reject.
        </p>
      </div>

      <IntelligenceTabs active={activeTab} />

      {activeTab === 'agents' && <AgentsTab supabaseFetch={supabase} />}
      {activeTab === 'organizations' && <OrganizationsTab supabaseFetch={supabase} />}
      {activeTab === 'workflows' && <WorkflowsTab supabaseFetch={supabase} />}
      {activeTab === 'predictions' && <PredictionsTab supabaseFetch={supabase} organizations={organizations} />}
      {activeTab === 'recommendations' && <RecommendationsTab supabaseFetch={supabase} organizations={organizations} />}
      {activeTab === 'anomalies' && <AnomaliesTab supabaseFetch={supabase} />}
      {activeTab === 'reports' && <ReportsTab supabaseFetch={supabase} />}
    </div>
  )
}

async function AgentsTab({ supabaseFetch }: { supabaseFetch: Awaited<ReturnType<typeof createClient>> }) {
  const ranked = await rankAgents(supabaseFetch, 20)
  const profiles = await Promise.all(ranked.map((a) => getAgentIntelligence(supabaseFetch, a.agent_id)))
  const agents = ranked.map((a, i) => ({ ...a, profile: (profiles[i] as AgentProfileIntelligence | null) || undefined }))
  return <AgentIntelligenceList agents={agents} />
}

async function OrganizationsTab({ supabaseFetch }: { supabaseFetch: Awaited<ReturnType<typeof createClient>> }) {
  const ranked = await rankOrganizations(supabaseFetch, 20)
  const { data: healthRows } = await supabaseFetch.from('organization_health').select('*').in('organization_id', ranked.map((o) => o.organization_id))
  const healthById = new Map((healthRows as OrganizationHealth[] | null || []).map((h) => [h.organization_id, h]))
  const organizations = ranked.map((o) => ({ ...o, health: healthById.get(o.organization_id) }))
  return <OrganizationIntelligenceList organizations={organizations} />
}

async function WorkflowsTab({ supabaseFetch }: { supabaseFetch: Awaited<ReturnType<typeof createClient>> }) {
  const [best, worst, templates] = await Promise.all([
    findBestWorkflows(supabaseFetch, 10),
    findWorstWorkflows(supabaseFetch, 10),
    rankTemplates(supabaseFetch, 10),
  ])
  return (
    <div className="space-y-6">
      <WorkflowIntelligenceLists best={best} worst={worst} />
      <TemplateRankingList templates={templates} />
    </div>
  )
}

async function PredictionsTab({ supabaseFetch, organizations }: { supabaseFetch: Awaited<ReturnType<typeof createClient>>; organizations: { id: string; name: string }[] }) {
  const predictions = await getPredictions(supabaseFetch, 50)
  return (
    <div className="space-y-4">
      <OrgScopedActionControl organizations={organizations} action="predictions" label="Refresh Predictions" />
      <PredictionsList predictions={predictions} />
    </div>
  )
}

async function RecommendationsTab({ supabaseFetch, organizations }: { supabaseFetch: Awaited<ReturnType<typeof createClient>>; organizations: { id: string; name: string }[] }) {
  const recommendations = await getRecommendations(supabaseFetch, undefined, 50)
  return (
    <div className="space-y-4">
      <OrgScopedActionControl organizations={organizations} action="recommendations" label="Generate Recommendations" />
      {recommendations.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No recommendations yet — generate some for an organization above.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((r) => (
            <RecommendationCard key={r.id} recommendation={r} />
          ))}
        </div>
      )}
    </div>
  )
}

async function AnomaliesTab({ supabaseFetch }: { supabaseFetch: Awaited<ReturnType<typeof createClient>> }) {
  const anomalies = await detectAnomalies(supabaseFetch)
  return <AnomaliesPanel data={anomalies} />
}

async function ReportsTab({ supabaseFetch }: { supabaseFetch: Awaited<ReturnType<typeof createClient>> }) {
  const reports = await getExecutiveReports(supabaseFetch, 10)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <GenerateReportButton reportType="daily" />
        <GenerateReportButton reportType="weekly" />
        <GenerateReportButton reportType="monthly" />
      </div>
      {reports.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">No reports generated yet.</div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  )
}
