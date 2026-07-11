import Link from 'next/link'

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08081C] text-[#EDEAF8]">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm text-[#6D28D9] hover:underline">← Back</Link>
        <h1 className="font-['Space_Grotesk'] text-3xl font-bold mt-4 mb-1">{title}</h1>
        <p className="text-xs text-[#8A88A8] mb-8">Last updated: {updated}</p>
        <div className="space-y-6 text-sm text-[#C9C7DE] leading-relaxed [&_h2]:font-['Space_Grotesk'] [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#EDEAF8] [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-[#EDEAF8]">
          {children}
        </div>
      </div>
    </div>
  )
}
