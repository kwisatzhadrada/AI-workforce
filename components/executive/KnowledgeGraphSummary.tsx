import { KnowledgeGraph } from '@/lib/types'

// Not an interactive graph — an honest summary of the same relational
// connections (goals -> agents -> tasks -> outcomes) the Executive Agent
// actually reasons over, so this panel shows real counts and real
// examples rather than a decorative diagram.
export default function KnowledgeGraphSummary({ graph }: { graph: KnowledgeGraph | null }) {
  if (!graph) return null

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">How Your Business Connects</h3>
      <p className="text-xs text-[#8A88A8] mb-3">What the Executive Agent reasons over, in one view.</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{graph.nodes.goals}</div>
          <div className="text-[10px] text-[#8A88A8]">Goals</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{graph.nodes.agents}</div>
          <div className="text-[10px] text-[#8A88A8]">Agents</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{graph.nodes.tasks}</div>
          <div className="text-[10px] text-[#8A88A8]">Tasks</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{graph.nodes.meetings}</div>
          <div className="text-[10px] text-[#8A88A8]">Meetings</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{graph.nodes.experiments}</div>
          <div className="text-[10px] text-[#8A88A8]">Experiments</div>
        </div>
      </div>
      {graph.edges.goal_to_agent.length > 0 && (
        <p className="text-xs text-[#8A88A8]">
          {graph.edges.goal_to_agent.slice(0, 3).map((e, i) => (
            <span key={i}>{i > 0 && ' · '}&ldquo;{e.goal}&rdquo; runs through {e.agent}</span>
          ))}
        </p>
      )}
    </div>
  )
}
