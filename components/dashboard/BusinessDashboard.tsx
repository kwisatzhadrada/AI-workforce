'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BusinessDashboardData } from '@/lib/businessDashboard'
import { AgentActivitySummary, SalesActivityType } from '@/lib/types'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pluralize(count: number, noun: string, pluralNoun?: string): string {
  return count === 1 ? noun : (pluralNoun || `${noun}s`)
}

const ACTIVITY_PHRASE: Record<SalesActivityType, (count: number) => string> = {
  lead_found: (n) => `found ${n} ${pluralize(n, 'lead')}`,
  email_drafted: (n) => `drafted ${n} ${pluralize(n, 'email')}`,
  email_sent: (n) => `sent ${n} ${pluralize(n, 'email')}`,
  reply_received: (n) => `logged ${n} ${pluralize(n, 'reply', 'replies')}`,
  meeting_booked: (n) => `booked ${n} ${pluralize(n, 'meeting')}`,
  contact_synced: (n) => `updated ${n} ${pluralize(n, 'contact')}`,
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'default' }) {
  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
      <div className="text-xs text-[#8A88A8] mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone === 'good' ? 'text-green-400' : 'text-[#EDEAF8]'}`}>{value}</div>
    </div>
  )
}

function AgentActivityLine({ activity }: { activity: AgentActivitySummary }) {
  const phrase = ACTIVITY_PHRASE[activity.activityType]
  return (
    <div className="text-sm text-[#EDEAF8] py-1.5 border-b border-[#3C3A58]/20 last:border-0">
      <span className="font-medium">{activity.agentName}</span> {phrase(activity.count)}
    </div>
  )
}

export default function BusinessDashboard({ organizationId, data }: { organizationId: string; data: BusinessDashboardData }) {
  const [ceoMode, setCeoMode] = useState(false)
  const { metrics, pipeline, emailQueue, costEstimate, agentActivity, today, pendingApproval, recommendations } = data

  const leadsFound = metrics?.leads_found || 0
  const meetingsBooked = metrics?.meetings_booked || 0
  const opportunitiesCreated = metrics?.replies_received || 0
  const conversionRate = leadsFound > 0 ? Math.round((meetingsBooked / leadsFound) * 100) : 0
  const activeCampaigns = pipeline && (pipeline.discovered > 0 || pipeline.enriched > 0) ? 1 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">
          {ceoMode ? 'CEO Mode' : 'Business Dashboard'}
        </h2>
        <button
          onClick={() => setCeoMode((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9] hover:text-[#EDEAF8]"
        >
          {ceoMode ? 'Show Full Dashboard' : 'Switch to CEO Mode'}
        </button>
      </div>

      {ceoMode ? (
        <div className="space-y-6">
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-3">What Happened Today</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Prospects Found" value={today.leadsFound} />
              <Stat label="Emails Sent" value={today.emailsSent} />
              <Stat label="Replies Received" value={today.repliesReceived} />
              <Stat label="Meetings Booked" value={today.meetingsBooked} />
            </div>
          </div>

          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-2">What Requires Approval</h3>
            {pendingApproval > 0 ? (
              <p className="text-sm text-[#EDEAF8]">
                {pendingApproval} draft email{pendingApproval === 1 ? '' : 's'} waiting for your review —{' '}
                <Link href={`/organizations/${organizationId}?tab=campaign`} className="text-[#6D28D9] hover:underline">review now</Link>.
              </p>
            ) : (
              <p className="text-sm text-[#8A88A8]">Nothing waiting on you right now.</p>
            )}
          </div>

          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-2">Recommendations</h3>
            <ul className="space-y-1.5">
              {recommendations.map((r, i) => (
                <li key={i} className="text-sm text-[#EDEAF8] flex gap-2">
                  <span className="text-[#6D28D9]">→</span> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-3">Revenue</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Estimated Pipeline Value" value={formatCurrency(metrics?.estimated_pipeline_value || 0)} tone="good" />
              <Stat label="Meetings Booked" value={meetingsBooked} />
              <Stat label="Opportunities Created" value={opportunitiesCreated} />
              <Stat label="Conversion Rate" value={`${conversionRate}%`} />
            </div>
            {costEstimate > 0 && (
              <p className="text-xs text-[#8A88A8] mt-3">This campaign has cost {formatCurrency(costEstimate)} to run so far.</p>
            )}
          </div>

          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-3">Campaign Health</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Active Campaigns" value={activeCampaigns} />
              <Stat label="Prospects Found" value={leadsFound} />
              <Stat label="Emails Sent" value={metrics?.emails_sent || 0} />
              <Stat label="Reply Rate" value={`${metrics?.reply_rate || 0}%`} />
            </div>
          </div>

          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
            <h3 className="font-medium text-[#EDEAF8] mb-2">Agent Activity</h3>
            {agentActivity.length === 0 ? (
              <p className="text-sm text-[#8A88A8]">No agent activity yet — launch a campaign to get started.</p>
            ) : (
              <div>
                {agentActivity.map((a) => (
                  <AgentActivityLine key={`${a.agentId}:${a.activityType}`} activity={a} />
                ))}
              </div>
            )}
          </div>

          {emailQueue && emailQueue.pending_approval > 0 && (
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
              <p className="text-sm text-[#EDEAF8]">
                {emailQueue.pending_approval} draft email{emailQueue.pending_approval === 1 ? '' : 's'} waiting for your review —{' '}
                <Link href={`/organizations/${organizationId}?tab=campaign`} className="text-[#6D28D9] hover:underline">review now</Link>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
