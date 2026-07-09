import { ERROR_REFERENCE } from '@/lib/errorReference'

export const dynamic = 'force-dynamic'

export default function ErrorReferencePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Error Reference</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Every error message this platform actually produces — what it means, and what to do about it.
        </p>
      </div>

      <div className="space-y-3">
        {ERROR_REFERENCE.map((e, i) => (
          <div key={i} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <p className="text-sm text-[#EDEAF8] font-mono mb-2">{e.message}</p>
            <p className="text-xs text-[#8A88A8] mb-2"><span className="text-[#8A88A8] font-medium">What it means: </span>{e.meaning}</p>
            <p className="text-xs text-green-400"><span className="font-medium">Fix: </span>{e.fix}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
