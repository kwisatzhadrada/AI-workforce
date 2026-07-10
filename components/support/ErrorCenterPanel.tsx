'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveJobFailure } from '@/lib/jobs'
import { JobFailure } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

function FailureRow({ failure }: { failure: JobFailure }) {
  const supabase = createClient()
  const router = useRouter()
  const [resolving, setResolving] = useState(false)

  async function resolve() {
    setResolving(true)
    await resolveJobFailure(supabase, failure.id)
    setResolving(false)
    router.refresh()
  }

  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-md border capitalize text-[#EDEAF8] bg-[#0C0D22] border-[#3C3A58]">{failure.job_type.replace('_', ' ')}</span>
          {failure.will_retry ? (
            <span className="text-xs px-2 py-0.5 rounded-md border text-yellow-400 bg-yellow-400/10 border-yellow-400/20">Retrying</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-md border text-red-400 bg-red-400/10 border-red-400/20">Failed</span>
          )}
        </div>
        <span className="text-xs text-[#8A88A8]">{formatTimeAgo(failure.created_at)}</span>
      </div>
      <div className="text-sm text-[#EDEAF8] mb-1">{failure.organizations?.name || 'Unknown organization'}</div>
      <div className="text-xs text-[#8A88A8]">{failure.error_message}</div>
      {!failure.resolved ? (
        <button onClick={resolve} disabled={resolving} className="text-xs text-[#6D28D9] hover:underline mt-2 disabled:opacity-50">
          {resolving ? 'Resolving...' : 'Mark resolved'}
        </button>
      ) : (
        <div className="text-xs text-green-400 mt-2">Resolved</div>
      )}
    </div>
  )
}

export default function ErrorCenterPanel({ failures }: { failures: JobFailure[] }) {
  const unresolved = failures.filter((f) => !f.resolved)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Error Center</h3>
      <p className="text-xs text-[#8A88A8] mb-3">Failed background jobs — reply checks, CRM syncs, brief generation, and more. {unresolved.length} unresolved.</p>
      {failures.length === 0 ? (
        <p className="text-sm text-[#8A88A8]">No failures recorded.</p>
      ) : (
        <div className="space-y-2">
          {failures.map((f) => <FailureRow key={f.id} failure={f} />)}
        </div>
      )}
    </div>
  )
}
