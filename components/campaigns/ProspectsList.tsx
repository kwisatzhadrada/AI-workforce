type Lead = { name: string | null; email: string; title: string | null; company: string | null; domain: string }

export default function ProspectsList({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return null
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-xs text-[#8A88A8] mb-2">
        Review before continuing — every row below is a real, Hunter.io-verified contact, not a guess.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[#8A88A8] border-b border-[#3C3A58]/30">
            <th className="py-1.5 pr-3">Name</th>
            <th className="py-1.5 pr-3">Email</th>
            <th className="py-1.5 pr-3">Title</th>
            <th className="py-1.5 pr-3">Company</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr key={`${l.email}-${i}`} className="border-b border-[#3C3A58]/10 last:border-0">
              <td className="py-1.5 pr-3 text-[#EDEAF8]">{l.name || '—'}</td>
              <td className="py-1.5 pr-3 text-[#EDEAF8]">{l.email}</td>
              <td className="py-1.5 pr-3 text-[#8A88A8]">{l.title || '—'}</td>
              <td className="py-1.5 pr-3 text-[#8A88A8]">{l.company || l.domain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
