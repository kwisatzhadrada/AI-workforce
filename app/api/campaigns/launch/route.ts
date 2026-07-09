import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { launchCampaign } from '@/lib/campaigns'
import { ModelProviderName } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const result = await launchCampaign(supabase, {
    organizationId: body.organization_id,
    createdBy: user.id,
    targetIndustry: body.target_industry || '',
    companySize: body.company_size || '',
    location: body.location || '',
    icpDescription: body.icp_description || '',
    domains: body.domains || undefined,
    provider: body.provider as ModelProviderName | undefined,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error, goalId: result.goalId }, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
