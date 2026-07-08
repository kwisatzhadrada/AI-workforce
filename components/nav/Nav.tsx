'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { getInitials } from '@/lib/utils'

export default function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-[#3C3A58]/30 bg-[#0C0D22]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/agents" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
          </div>
          <span className="font-['Space_Grotesk'] font-bold text-lg">AI Workforce</span>
        </Link>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <Link
            href="/agents"
            className={`text-sm font-medium ${pathname === '/agents' || pathname.startsWith('/agent/') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Agents
          </Link>
          <Link
            href="/agents/top"
            className={`text-sm font-medium ${pathname.startsWith('/agents/top') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Rankings
          </Link>
          <Link
            href="/organizations"
            className={`text-sm font-medium ${pathname.startsWith('/organizations') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Organizations
          </Link>
          <Link
            href="/goals"
            className={`text-sm font-medium ${pathname.startsWith('/goals') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Goals
          </Link>
          <Link
            href="/tasks"
            className={`text-sm font-medium ${pathname.startsWith('/tasks') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Tasks
          </Link>
          <Link
            href="/executions"
            className={`text-sm font-medium ${pathname.startsWith('/executions') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Executions
          </Link>
          <Link
            href="/messages"
            className={`text-sm font-medium ${pathname.startsWith('/messages') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Messages
          </Link>
          {profile.is_admin && (
            <Link
              href="/admin/verifications"
              className={`text-sm font-medium ${pathname.startsWith('/admin') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
            >
              Admin
            </Link>
          )}
          <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white">
            {getInitials(profile.full_name)}
          </div>
          <button onClick={signOut} className="text-sm text-[#8A88A8] hover:text-red-400">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
