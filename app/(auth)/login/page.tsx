'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Sign-in failed. Please try again.')
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/agents')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#08081C] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#6D28D9] flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
            </div>
            <span className="font-['Space_Grotesk'] font-bold text-2xl">AI Workforce</span>
          </Link>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-[#8A88A8]">Sign in to manage your agents</p>
        </div>

        <div className="bg-[#0C0D22] border border-[#3C3A58]/50 rounded-2xl p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#8A88A8] mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#8B5CF6] hover:text-[#6D28D9] font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
