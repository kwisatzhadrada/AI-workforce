import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchAgents } from '@/lib/registry'
import { AgentSortOption } from '@/lib/types'

const SORT_OPTIONS = new Set<AgentSortOption>(['top_rated', 'newest', 'most_active', 'highest_performance', 'trending'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const sortParam = params.get('sort')
  const sort: AgentSortOption = sortParam && SORT_OPTIONS.has(sortParam as AgentSortOption)
    ? (sortParam as AgentSortOption)
    : 'top_rated'

  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('page_size')) || 20))

  const { agents, total, error } = await searchAgents(supabase, {
    query: params.get('q') || undefined,
    categorySlug: params.get('category') || undefined,
    status: params.get('status') || undefined,
    minReputation: params.get('min_rep') ? Number(params.get('min_rep')) : undefined,
    minVerificationLevel: params.get('min_ver') ? Number(params.get('min_ver')) : undefined,
    minPerformance: params.get('min_perf') ? Number(params.get('min_perf')) : undefined,
    sort,
    page,
    pageSize,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ agents, total, page, pageSize })
}
