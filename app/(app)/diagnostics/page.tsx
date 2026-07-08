import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getAssignmentDecisions,
  getExecutionFailures,
  getExecutionHistory,
  getIntegrationHistory,
  getTaskRetryCounts,
} from '@/lib/diagnostics'
import ExecutionHistoryPanel from '@/components/diagnostics/ExecutionHistoryPanel'
import IntegrationHistoryPanel from '@/components/diagnostics/IntegrationHistoryPanel'
import ExecutionFailuresPanel from '@/components/diagnostics/ExecutionFailuresPanel'
import RetriesPanel from '@/components/diagnostics/RetriesPanel'
import AssignmentDecisionsPanel from '@/components/diagnostics/AssignmentDecisionsPanel'

export const dynamic = 'force-dynamic'

export default async function DiagnosticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [executions, integrations, failures, retries, decisions] = await Promise.all([
    getExecutionHistory(supabase, 50),
    getIntegrationHistory(supabase, 50),
    getExecutionFailures(supabase, 50),
    getTaskRetryCounts(supabase, 50),
    getAssignmentDecisions(supabase, 50),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Diagnostics</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Network-wide execution, integration, and assignment activity — everything the goal manager and runtime
          actually did, and why.
        </p>
      </div>

      <AssignmentDecisionsPanel rows={decisions} />
      <ExecutionHistoryPanel rows={executions} />
      <ExecutionFailuresPanel rows={failures} />
      <RetriesPanel rows={retries} />
      <IntegrationHistoryPanel rows={integrations} />
    </div>
  )
}
