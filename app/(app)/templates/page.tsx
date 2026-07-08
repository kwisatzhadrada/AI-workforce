import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateMetrics, WorkforceTemplate } from '@/lib/types'
import TemplateCard from '@/components/templates/TemplateCard'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase.from('workforce_templates').select('*').order('usage_count', { ascending: false })

  const metricsEntries = await Promise.all(
    ((templates as WorkforceTemplate[]) || []).map(async (t) => {
      const { data } = await supabase.rpc('get_template_metrics', { p_template_id: t.id }).single()
      return [t.id, data as TemplateMetrics] as const
    })
  )
  const metricsById = new Map(metricsEntries)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Templates</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Deploy a complete AI-staffed organization in one step.</p>
      </div>

      {((templates as WorkforceTemplate[]) || []).length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No templates available yet.</div>
      ) : (
        <div className="space-y-4">
          {(templates as WorkforceTemplate[]).map((t) => (
            <TemplateCard key={t.id} template={t} metrics={metricsById.get(t.id) || null} />
          ))}
        </div>
      )}
    </div>
  )
}
