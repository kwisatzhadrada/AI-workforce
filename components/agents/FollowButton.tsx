'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { followEntity, unfollowEntity } from '@/lib/registry'

export default function FollowButton({
  currentUserId,
  agentId,
  initialFollowing,
  followersCount,
}: {
  currentUserId: string
  agentId: string
  initialFollowing: boolean
  followersCount: number
}) {
  const supabase = createClient()
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(followersCount)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const follower = { type: 'user' as const, id: currentUserId }
    const followee = { type: 'agent' as const, id: agentId }

    if (following) {
      const { error } = await unfollowEntity(supabase, follower, followee)
      if (!error) {
        setFollowing(false)
        setCount((c) => Math.max(0, c - 1))
      }
    } else {
      const { error } = await followEntity(supabase, follower, followee)
      if (!error) {
        setFollowing(true)
        setCount((c) => c + 1)
      }
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? 'bg-[#6D28D9]/20 border border-[#6D28D9]/40 text-[#8B5CF6] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
          : 'bg-[#6D28D9] hover:bg-[#8B5CF6] text-white'
      }`}
    >
      {following ? 'Following ✓' : '+ Follow'} · {count}
    </button>
  )
}
