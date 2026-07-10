import { ExecutiveCommandCenterData } from '@/lib/executiveCommandCenter'
import AutonomyLevelControl from './AutonomyLevelControl'
import ExecutiveBriefPanel from './ExecutiveBriefPanel'
import RecommendationsPanel from './RecommendationsPanel'
import PerformanceIntelligencePanel from './PerformanceIntelligencePanel'
import KnowledgeGraphSummary from './KnowledgeGraphSummary'

// The mission's own success criteria: a business owner should be able to
// answer "are we growing, are campaigns working, what should we do next,
// what's blocking success, where is revenue coming from" without
// understanding tasks, workflows, agents, plans, executions, or the
// database — this tab is that answer, assembled entirely from data other
// tabs already compute.
export default function ExecutiveCommandCenter({ organizationId, data, isManager }: { organizationId: string; data: ExecutiveCommandCenterData; isManager: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">Executive Command Center</h2>
        <p className="text-xs text-[#8A88A8] mt-1">Are we growing? Are campaigns working? What should we do next?</p>
      </div>

      <RecommendationsPanel recommendations={data.recommendations} />
      <ExecutiveBriefPanel organizationId={organizationId} brief={data.latestBrief} />
      <PerformanceIntelligencePanel performance={data.performance} />
      <KnowledgeGraphSummary graph={data.knowledgeGraph} />
      <AutonomyLevelControl organizationId={organizationId} level={data.executive?.autonomy_level ?? 2} isManager={isManager} />
    </div>
  )
}
