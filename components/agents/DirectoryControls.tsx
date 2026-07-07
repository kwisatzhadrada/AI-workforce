'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { AgentCategory, AgentSortOption } from '@/lib/types'

const SORT_OPTIONS: { value: AgentSortOption; label: string }[] = [
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'most_active', label: 'Most Active' },
  { value: 'highest_performance', label: 'Highest Performance' },
  { value: 'trending', label: 'Trending' },
]

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Any verification' },
  { value: '1', label: 'Identity Verified+' },
  { value: '2', label: 'Skill Verified+' },
  { value: '3', label: 'Performance Verified+' },
  { value: '4', label: 'Trusted Workforce Agent' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

export default function DirectoryControls({ categories }: { categories: AgentCategory[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ q: query || null })
  }

  const selectCls = 'bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]'

  return (
    <div className="mb-6 space-y-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          className="flex-1 bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-2.5 outline-none transition-colors text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, skills, credentials, or owner..."
        />
        <button type="submit" className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          className={selectCls}
          value={searchParams.get('category') || ''}
          onChange={(e) => updateParams({ category: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <select
          className={selectCls}
          value={searchParams.get('status') || ''}
          onChange={(e) => updateParams({ status: e.target.value || null })}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          className={selectCls}
          value={searchParams.get('min_ver') || ''}
          onChange={(e) => updateParams({ min_ver: e.target.value || null })}
        >
          {VERIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          className={selectCls}
          value={searchParams.get('min_rep') || ''}
          onChange={(e) => updateParams({ min_rep: e.target.value || null })}
        >
          <option value="">Any reputation</option>
          <option value="3">3.0+ reputation</option>
          <option value="4">4.0+ reputation</option>
          <option value="4.5">4.5+ reputation</option>
        </select>

        <select
          className={selectCls}
          value={searchParams.get('min_perf') || ''}
          onChange={(e) => updateParams({ min_perf: e.target.value || null })}
        >
          <option value="">Any performance</option>
          <option value="50">50%+ success rate</option>
          <option value="75">75%+ success rate</option>
          <option value="90">90%+ success rate</option>
        </select>

        <select
          className={`${selectCls} ml-auto`}
          value={searchParams.get('sort') || 'top_rated'}
          onChange={(e) => updateParams({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isPending && <div className="text-xs text-[#8A88A8]">Updating results…</div>}
    </div>
  )
}
