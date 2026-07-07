import { AgentCategory } from '@/lib/types'

export default function CategoryBadges({ categories }: { categories: AgentCategory[] }) {
  if (categories.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <span key={c.id} className="text-xs px-2 py-0.5 rounded-md bg-[#6D28D9]/10 border border-[#6D28D9]/30 text-[#C4B5FD]">
          {c.name}
        </span>
      ))}
    </div>
  )
}
