'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { submitDesignPartnerApplication } from '@/lib/designPartnerApplications'

const TEAM_SIZES = ['Just me', '2-5', '6-20', '21-50', '50+']

export default function ApplyPage() {
  const supabase = createClient()
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [currentSalesProcess, setCurrentSalesProcess] = useState('')
  const [goals, setGoals] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = companyName.trim() && industry.trim() && teamSize && currentSalesProcess.trim() && goals.trim() && contactName.trim() && contactEmail.trim()

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { error } = await submitDesignPartnerApplication(supabase, {
      companyName, industry, teamSize, currentSalesProcess, goals, contactName, contactEmail,
      contactRole: contactRole || null,
    })
    setSubmitting(false)
    if (error) { setError(error); return }
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-[#08081C] text-[#EDEAF8] px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-[#6D28D9] hover:underline">← Back</Link>
        <h1 className="font-['Space_Grotesk'] text-3xl font-bold mt-4 mb-2">Become a design partner</h1>
        <p className="text-[#8A88A8] text-sm mb-8">
          We&apos;re working closely with a small first group of companies to prove this works — real campaigns,
          real meetings, direct access to our team. Tell us about your business and we&apos;ll follow up.
        </p>

        {submitted ? (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-6 text-sm">
            Thanks — we&apos;ve received your application and will follow up at {contactEmail}.
          </div>
        ) : (
          <div className="bg-[#0C0D22] border border-[#3C3A58]/50 rounded-2xl p-6 space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Company name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc."
                className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Industry</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech, SaaS, Recruiting"
                  className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Team size</label>
                <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)}
                  className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]">
                  <option value="">Select...</option>
                  {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">How do you currently do sales outreach?</label>
              <textarea value={currentSalesProcess} onChange={(e) => setCurrentSalesProcess(e.target.value)} rows={3}
                placeholder="e.g. Manually, one founder doing LinkedIn + cold email, no CRM yet"
                className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">What are you hoping to achieve?</label>
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3}
                placeholder="e.g. Book 10 qualified meetings a month without hiring an SDR"
                className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Your name</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Founder"
                  className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Your role (optional)</label>
                <input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="CEO, Head of Sales..."
                  className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@company.com"
                className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#6D28D9]" />
            </div>
            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit application'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
