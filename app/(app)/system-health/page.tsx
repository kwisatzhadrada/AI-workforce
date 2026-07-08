import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAutonomyScore, getBottlenecks, getNetworkHealth, getSimulationRuns, getSystemReports } from '@/lib/simulation'
import NetworkHealthPanel from '@/components/system-health/NetworkHealthPanel'
import AutonomyScorePanel from '@/components/system-health/AutonomyScorePanel'
import SimulationRunsList from '@/components/system-health/SimulationRunsList'
import BottlenecksPanel from '@/components/system-health/BottlenecksPanel'
import RunSimulationButton from '@/components/system-health/RunSimulationButton'
import GenerateReportButton from '@/components/system-health/GenerateReportButton'
import ReportCard from '@/components/system-health/ReportCard'

export const dynamic = 'force-dynamic'

export default async function SystemHealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [health, autonomy, bottlenecks, runs, reports] = await Promise.all([
    getNetworkHealth(supabase),
    getAutonomyScore(supabase),
    getBottlenecks(supabase),
    getSimulationRuns(supabase, 5),
    getSystemReports(supabase, 5),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Network Health</h1>
          <p className="text-[#8A88A8] text-sm mt-1">
            Validate the workforce network under real operating conditions: seed synthetic load through the real
            deployment, planning, and execution machinery, then observe what happens.
          </p>
        </div>
        <RunSimulationButton />
      </div>

      <NetworkHealthPanel health={health} />
      <AutonomyScorePanel score={autonomy} />
      <SimulationRunsList runs={runs} />
      <BottlenecksPanel data={bottlenecks} />

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">Executive Reports</h2>
          <div className="flex items-center gap-2">
            <GenerateReportButton reportType="daily" />
            <GenerateReportButton reportType="weekly" />
            <GenerateReportButton reportType="monthly" />
          </div>
        </div>
        {reports.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
            No reports generated yet.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
