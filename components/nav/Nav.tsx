'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { getInitials } from '@/lib/utils'
import NavDropdown from './NavDropdown'

const WORKSPACE_ITEMS = [
  { href: '/agents', label: 'Agents' },
  { href: '/agents/top', label: 'Rankings' },
  { href: '/templates', label: 'Templates' },
  { href: '/goals', label: 'Goals' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/executions', label: 'Executions' },
  { href: '/support', label: 'Support' },
  { href: '/help/errors', label: 'Error Reference' },
]

const ADMIN_ITEMS = [
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/system-health', label: 'System Health' },
  { href: '/intelligence', label: 'Intelligence' },
  { href: '/diagnostics', label: 'Diagnostics' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/support', label: 'Support Tools' },
  { href: '/admin/support/conversations', label: 'Conversations' },
  { href: '/admin/design-partners', label: 'Design Partners' },
]

export default function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const workspaceActive = WORKSPACE_ITEMS.some((i) => pathname.startsWith(i.href)) || pathname.startsWith('/agent/')
  const adminActive = ADMIN_ITEMS.some((i) => pathname.startsWith(i.href))

  return (
    <nav className="no-print border-b border-[#3C3A58]/30 bg-[#0C0D22]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/agents" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
          </div>
          <span className="font-['Space_Grotesk'] font-bold text-lg">AI Workforce</span>
        </Link>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <Link
            href="/onboarding"
            className={`text-sm font-medium px-3 py-1.5 rounded-lg ${pathname.startsWith('/onboarding') ? 'bg-[#6D28D9] text-white' : 'bg-[#6D28D9]/20 text-[#6D28D9] hover:bg-[#6D28D9]/30'}`}
          >
            Get Started
          </Link>
          <Link
            href="/organizations"
            className={`text-sm font-medium ${pathname.startsWith('/organizations') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Organizations
          </Link>
          <Link
            href="/messages"
            className={`text-sm font-medium ${pathname.startsWith('/messages') ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
          >
            Messages
          </Link>
          <NavDropdown label="Workspace" items={WORKSPACE_ITEMS} active={workspaceActive} />
          {profile.is_admin && <NavDropdown label="Admin" items={ADMIN_ITEMS} active={adminActive} />}
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
