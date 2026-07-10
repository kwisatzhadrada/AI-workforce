import { RevenueMetrics } from '@/lib/types'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function RevenueMetricsPanel({ metrics }: { metrics: RevenueMetrics | null }) {
  const m = metrics || { mrr: 0, arr: 0, active_customers: 0, churned_last_30d: 0, churn_rate_pct: 0 }
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Revenue</h2>
      <p className="text-xs text-[#8A88A8] mb-3">From manually logged subscription events — real dollar figures, not estimates.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">MRR</div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">{formatCurrency(m.mrr)}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">ARR</div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">{formatCurrency(m.arr)}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Active Customers</div>
          <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{m.active_customers}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Churn (30d)</div>
          <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{m.churn_rate_pct}%</div>
          <div className="text-[10px] text-[#8A88A8]">{m.churned_last_30d} cancelled</div>
        </div>
      </div>
    </div>
  )
}
