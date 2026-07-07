'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export default function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function hrefFor(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    return `${pathname}?${params.toString()}`
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-6">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`px-4 py-2 rounded-lg text-sm border border-[#3C3A58] ${page <= 1 ? 'pointer-events-none opacity-40' : 'text-[#EDEAF8] hover:border-[#6D28D9]'}`}
      >
        ← Previous
      </Link>
      <span className="text-sm text-[#8A88A8]">
        Page {page} of {totalPages} · {total.toLocaleString()} agents
      </span>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={`px-4 py-2 rounded-lg text-sm border border-[#3C3A58] ${page >= totalPages ? 'pointer-events-none opacity-40' : 'text-[#EDEAF8] hover:border-[#6D28D9]'}`}
      >
        Next →
      </Link>
    </div>
  )
}
