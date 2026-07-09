'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export type NavDropdownItem = { href: string; label: string }

// Collapses a group of related links behind one toggle — introduced to
// cut nav clutter for a non-technical design partner, whose entire real
// journey is Get Started -> Organizations -> Messages. Everything else
// here still exists and still works exactly as before; it's just not
// competing for attention in the primary nav on every single page.
export default function NavDropdown({ label, items, active }: { label: string; items: NavDropdownItem[]; active: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-sm font-medium flex items-center gap-1 ${active ? 'text-[#EDEAF8]' : 'text-[#8A88A8] hover:text-[#EDEAF8]'}`}
      >
        {label}
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-[#0C0D22] border border-[#3C3A58] rounded-lg shadow-xl py-1 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-[#8A88A8] hover:text-[#EDEAF8] hover:bg-[#121428]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
