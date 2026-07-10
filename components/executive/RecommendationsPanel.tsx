export default function RecommendationsPanel({ recommendations }: { recommendations: string[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Recommended Next Actions</h3>
      <p className="text-xs text-[#8A88A8] mb-3">Data-backed — every one of these comes from your own campaign's real numbers.</p>
      <ul className="space-y-1.5">
        {recommendations.map((r, i) => (
          <li key={i} className="text-sm text-[#EDEAF8] flex gap-2">
            <span className="text-[#6D28D9]">→</span> {r}
          </li>
        ))}
      </ul>
    </div>
  )
}
