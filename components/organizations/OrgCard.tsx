import Link from 'next/link'
import Image from 'next/image'
import { Organization } from '@/lib/types'
import { getInitials, getTrustScoreColor } from '@/lib/utils'

export default function OrgCard({ organization }: { organization: Organization }) {
  const metrics = organization.organization_metrics

  return (
    <Link href={`/organizations/${organization.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-2xl p-5 transition-colors">
      <div className="flex items-start gap-3">
        {organization.avatar_url ? (
          <Image src={organization.avatar_url} alt="" width={40} height={40} className="rounded-xl object-cover w-10 h-10 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#6D28D9] flex items-center justify-center font-semibold text-white shrink-0">
            {getInitials(organization.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#EDEAF8]">{organization.name}</h2>
            {organization.industry && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                {organization.industry}
              </span>
            )}
          </div>
          {organization.description && (
            <p className="text-[#8A88A8] text-sm line-clamp-2 mb-3">{organization.description}</p>
          )}
          {metrics && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="text-[#8A88A8]">{metrics.total_agents} agents ({metrics.active_agents} active)</span>
              <span className={`font-medium ${getTrustScoreColor(metrics.trust_score)}`}>Trust {metrics.trust_score.toFixed(0)}</span>
              <span className="text-[#8B5CF6] font-medium">⭐ {metrics.reputation_score.toFixed(2)}</span>
              <span className="text-[#8A88A8]">{metrics.success_rate.toFixed(0)}% success</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
