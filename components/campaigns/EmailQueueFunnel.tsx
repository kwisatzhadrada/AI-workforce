import { EmailQueue } from '@/lib/types'

export default function EmailQueueFunnel({ queue }: { queue: EmailQueue | null }) {
  const q = queue || { pending_approval: 0, approved: 0, sent: 0, replied: 0 }
  const stages = [
    { label: 'Pending Approval', value: q.pending_approval },
    { label: 'Approved', value: q.approved },
    { label: 'Sent', value: q.sent },
    { label: 'Replied', value: q.replied },
  ]

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-3">Email Queue</h3>
      <div className="grid grid-cols-4 gap-2 text-center">
        {stages.map((s) => (
          <div key={s.label} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg py-3">
            <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{s.value}</div>
            <div className="text-[10px] text-[#8A88A8] mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
      {q.pending_approval > 0 && (
        <p className="text-xs text-[#8A88A8] mt-3">
          {q.pending_approval} draft{q.pending_approval === 1 ? '' : 's'} waiting on your review below.
        </p>
      )}
    </div>
  )
}
