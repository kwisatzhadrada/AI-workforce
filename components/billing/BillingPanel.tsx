'use client'

import { useState } from 'react'
import { OrganizationBillingStatus, SubscriptionPlan } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Payment past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Trial expired, no payment on file',
  unpaid: 'Unpaid',
}

const STATUS_COLOR: Record<string, string> = {
  trialing: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  active: 'text-green-400 bg-green-400/10 border-green-400/20',
  past_due: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  canceled: 'text-red-400 bg-red-400/10 border-red-400/20',
  incomplete: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  incomplete_expired: 'text-red-400 bg-red-400/10 border-red-400/20',
  unpaid: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const PLAN_LABEL: Record<SubscriptionPlan, string> = { standard: 'Standard', growth: 'Growth' }

async function postJSON(url: string, body: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { data: null, error: data.error || 'Something went wrong' }
  return { data, error: null }
}

export default function BillingPanel({ organizationId, status }: { organizationId: string; status: OrganizationBillingStatus | null }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout(plan: SubscriptionPlan) {
    setLoading(`checkout-${plan}`)
    setError(null)
    const { data, error } = await postJSON('/api/billing/checkout', { organization_id: organizationId, plan })
    setLoading(null)
    if (error) { setError(error); return }
    if (data?.url) window.location.href = data.url as string
  }

  async function openPortal() {
    setLoading('portal')
    setError(null)
    const { data, error } = await postJSON('/api/billing/portal', { organization_id: organizationId })
    setLoading(null)
    if (error) { setError(error); return }
    if (data?.url) window.location.href = data.url as string
  }

  async function changePlan(plan: SubscriptionPlan) {
    setLoading(`change-${plan}`)
    setError(null)
    const { error } = await postJSON('/api/billing/change-plan', { organization_id: organizationId, plan })
    setLoading(null)
    if (error) { setError(error); return }
    window.location.reload()
  }

  async function cancel() {
    if (!confirm('Cancel your subscription? You will keep access until the end of the current billing period.')) return
    setLoading('cancel')
    setError(null)
    const { error } = await postJSON('/api/billing/cancel', { organization_id: organizationId })
    setLoading(null)
    if (error) { setError(error); return }
    window.location.reload()
  }

  async function resume() {
    setLoading('resume')
    setError(null)
    const { error } = await postJSON('/api/billing/resume', { organization_id: organizationId })
    setLoading(null)
    if (error) { setError(error); return }
    window.location.reload()
  }

  if (!status) {
    return <p className="text-sm text-[#8A88A8]">Billing information isn&apos;t available right now.</p>
  }

  const hasSubscription = status.plan !== null && status.status !== 'canceled' && status.status !== 'incomplete_expired'

  return (
    <div className="space-y-4">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">Billing</h2>
          <span className={`text-xs px-2.5 py-1 rounded-md border ${STATUS_COLOR[status.status]}`}>{STATUS_LABEL[status.status]}</span>
        </div>

        {status.admin_comped && (
          <p className="text-sm text-cyan-400 mb-3">This organization has complimentary access — no payment needed.</p>
        )}

        {!status.admin_comped && status.status === 'trialing' && (
          <p className="text-sm text-[#8A88A8] mb-4">
            {status.days_left_in_trial > 0
              ? `${status.days_left_in_trial} day(s) left in your free trial. No card required until you're ready to subscribe.`
              : 'Your free trial has ended. Subscribe to keep sending campaigns.'}
          </p>
        )}

        {!status.admin_comped && status.cancel_at_period_end && status.current_period_end && (
          <p className="text-sm text-yellow-400 mb-4">
            Your subscription will end on {new Date(status.current_period_end).toLocaleDateString()}.
          </p>
        )}

        {!status.admin_comped && status.plan && (
          <p className="text-sm text-[#EDEAF8] mb-4">
            Current plan: <span className="font-medium">{PLAN_LABEL[status.plan]}</span>
            {status.current_period_end && !status.cancel_at_period_end && (
              <span className="text-[#8A88A8]"> · renews {formatTimeAgo(status.current_period_end)}</span>
            )}
          </p>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        {!status.admin_comped && !hasSubscription && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-[#121428] border border-[#3C3A58] rounded-xl p-4">
              <h3 className="font-medium text-[#EDEAF8] mb-1">Standard</h3>
              <p className="text-xs text-[#8A88A8] mb-3">For a single sales campaign running at a time.</p>
              <button
                onClick={() => startCheckout('standard')}
                disabled={loading !== null}
                className="w-full bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {loading === 'checkout-standard' ? 'Redirecting...' : 'Subscribe'}
              </button>
            </div>
            <div className="bg-[#121428] border border-[#3C3A58] rounded-xl p-4">
              <h3 className="font-medium text-[#EDEAF8] mb-1">Growth</h3>
              <p className="text-xs text-[#8A88A8] mb-3">Higher send volume and multiple concurrent campaigns.</p>
              <button
                onClick={() => startCheckout('growth')}
                disabled={loading !== null}
                className="w-full bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {loading === 'checkout-growth' ? 'Redirecting...' : 'Subscribe'}
              </button>
            </div>
          </div>
        )}

        {!status.admin_comped && hasSubscription && (
          <div className="flex flex-wrap gap-2">
            <button onClick={openPortal} disabled={loading !== null} className="text-sm bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] text-[#EDEAF8] px-4 py-2 rounded-lg disabled:opacity-50">
              {loading === 'portal' ? 'Opening...' : 'Manage payment method & invoices'}
            </button>
            {status.plan !== 'growth' && (
              <button onClick={() => changePlan('growth')} disabled={loading !== null} className="text-sm bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] text-[#EDEAF8] px-4 py-2 rounded-lg disabled:opacity-50">
                {loading === 'change-growth' ? 'Switching...' : 'Upgrade to Growth'}
              </button>
            )}
            {status.plan !== 'standard' && (
              <button onClick={() => changePlan('standard')} disabled={loading !== null} className="text-sm bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] text-[#EDEAF8] px-4 py-2 rounded-lg disabled:opacity-50">
                {loading === 'change-standard' ? 'Switching...' : 'Switch to Standard'}
              </button>
            )}
            {status.cancel_at_period_end ? (
              <button onClick={resume} disabled={loading !== null} className="text-sm bg-[#121428] border border-[#3C3A58] hover:border-green-400 text-green-400 px-4 py-2 rounded-lg disabled:opacity-50">
                {loading === 'resume' ? 'Resuming...' : 'Resume subscription'}
              </button>
            ) : (
              <button onClick={cancel} disabled={loading !== null} className="text-sm bg-[#121428] border border-[#3C3A58] hover:border-red-400 text-red-400 px-4 py-2 rounded-lg disabled:opacity-50">
                {loading === 'cancel' ? 'Cancelling...' : 'Cancel subscription'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
