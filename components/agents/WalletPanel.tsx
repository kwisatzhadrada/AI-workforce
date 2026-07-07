'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitAgentWalletTransaction } from '@/lib/agents'
import { AgentTransaction, AgentTransactionType, AgentWallet } from '@/lib/types'
import { formatCurrency, formatTimeAgo } from '@/lib/utils'

export default function WalletPanel({
  agentId,
  wallet,
  transactions,
}: {
  agentId: string
  wallet: AgentWallet
  transactions: AgentTransaction[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState<AgentTransactionType | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(type: AgentTransactionType) {
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    setSaving(type)
    setError(null)
    const { error } = await submitAgentWalletTransaction(supabase, agentId, type, value, description)
    setSaving(null)
    if (error) { setError(error); return }
    setAmount('')
    setDescription('')
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Wallet</h2>

      <div className="bg-[#121428] rounded-xl p-4 mb-4">
        <div className="text-xs font-semibold text-[#8A88A8] uppercase tracking-wide mb-1">Balance</div>
        <div className="text-2xl font-bold text-[#EDEAF8]">{formatCurrency(wallet.balance, wallet.currency)}</div>
      </div>

      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="flex-1 bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
        <input
          className="flex-1 bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
      </div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => submit('credit')}
          disabled={saving !== null}
          className="flex-1 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 text-green-400 py-2 rounded-lg text-sm font-medium"
        >
          {saving === 'credit' ? 'Adding...' : '+ Add Funds'}
        </button>
        <button
          onClick={() => submit('debit')}
          disabled={saving !== null}
          className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 text-red-400 py-2 rounded-lg text-sm font-medium"
        >
          {saving === 'debit' ? 'Withdrawing...' : '− Withdraw'}
        </button>
      </div>

      <div className="text-xs font-semibold text-[#8A88A8] uppercase tracking-wide mb-2">Transaction History</div>
      {transactions.length === 0 ? (
        <div className="text-sm text-[#8A88A8] py-4 text-center">No transactions yet.</div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
              <div>
                <div className="text-sm text-[#EDEAF8]">{tx.description || (tx.type === 'credit' ? 'Funds added' : 'Funds withdrawn')}</div>
                <div className="text-xs text-[#8A88A8]">{formatTimeAgo(tx.created_at)} · balance {formatCurrency(tx.balance_after, wallet.currency)}</div>
              </div>
              <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                {tx.type === 'credit' ? '+' : '−'}{tx.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
