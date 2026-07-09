import { ProspectPipeline } from '@/lib/types'

export default function ProspectPipelineFunnel({ pipeline }: { pipeline: ProspectPipeline | null }) {
  const p = pipeline || { discovered: 0, enriched: 0, contacted: 0, responded: 0, meeting_booked: 0 }
  const stages = [
    { label: 'Discovered', value: p.discovered },
    { label: 'Enriched', value: p.enriched },
    { label: 'Contacted', value: p.contacted },
    { label: 'Responded', value: p.responded },
    { label: 'Meeting Booked', value: p.meeting_booked },
  ]

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-3">Prospect Pipeline</h3>
      <div className="grid grid-cols-5 gap-2 text-center">
        {stages.map((s) => (
          <div key={s.label} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg py-3">
            <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{s.value}</div>
            <div className="text-[10px] text-[#8A88A8] mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
