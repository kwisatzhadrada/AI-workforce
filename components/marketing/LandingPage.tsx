import Link from 'next/link'

const STEPS = [
  { title: 'Connect your Gmail', body: 'Authorize your own Gmail account in a few clicks — nothing sends from a shared or unknown address.' },
  { title: 'Describe who you sell to', body: 'Tell it your target industry, company size, and location. It finds and enriches real prospects that match.' },
  { title: 'Review and approve', body: 'Every email is drafted for your approval first. Nothing sends until you say so.' },
  { title: 'Get replies and meetings', body: 'Replies are tracked automatically, and booked meetings show up on your dashboard — with the pipeline they created.' },
]

const TRUST_POINTS = [
  { title: 'Your Gmail, not a shared sender', body: 'Every email sends from your own connected account — your domain reputation stays yours.' },
  { title: 'You approve every email', body: 'Drafted outreach waits for a human click before anything goes out. No autopilot sending.' },
  { title: 'Real send limits, built in', body: 'A daily cap and duplicate-contact protection stop accidental oversending — enforced automatically, not just suggested.' },
  { title: 'A real audit trail', body: 'Every send, every campaign change, every deal outcome is logged — visible to your own team, not a black box.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08081C] text-[#EDEAF8]">
      <header className="border-b border-[#3C3A58]/30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            </div>
            <span className="font-['Space_Grotesk'] font-bold text-lg">AI Workforce</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">Log in</Link>
            <Link href="/signup" className="text-sm bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-4 py-2 rounded-lg font-medium">Start free trial</Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4">
        {/* Hero — one outcome, stated plainly */}
        <section className="py-16 text-center">
          <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl font-bold leading-tight text-balance">
            Book more sales meetings with an AI sales workforce
          </h1>
          <p className="text-[#8A88A8] text-lg mt-5 max-w-xl mx-auto">
            It finds your prospects, writes the outreach, sends it from your own Gmail, and tracks every reply
            through to a booked meeting — so your pipeline grows without you writing another cold email.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/signup" className="bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-6 py-3 rounded-xl font-semibold">
              Start your free trial
            </Link>
            <Link href="/login" className="border border-[#3C3A58] hover:border-[#6D28D9] text-[#EDEAF8] px-6 py-3 rounded-xl font-medium">
              Log in
            </Link>
          </div>
          <p className="text-xs text-[#8A88A8] mt-4">No card required to start. Cancel anytime.</p>
        </section>

        {/* What is this / who for */}
        <section className="grid sm:grid-cols-2 gap-4 py-8 border-t border-[#3C3A58]/30">
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-2">What this is</h2>
            <p className="text-sm text-[#8A88A8]">
              A sales outreach service that finds real prospects, drafts real outreach email, sends it through your
              own Gmail account, and tracks replies through to a booked meeting — the parts of prospecting most
              teams don&apos;t have time for, done for you and reviewable at every step.
            </p>
          </div>
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-2">Who it&apos;s for</h2>
            <p className="text-sm text-[#8A88A8]">
              Founders, agencies, and small sales teams doing their own B2B outbound — anyone who needs a real
              pipeline of qualified meetings without hiring or manually running cold outreach themselves.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-8 border-t border-[#3C3A58]/30">
          <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-center mb-8">How it works</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
                <div className="w-8 h-8 rounded-full bg-[#6D28D9]/20 text-[#6D28D9] flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-medium text-[#EDEAF8]">{step.title}</h3>
                  <p className="text-sm text-[#8A88A8] mt-1">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why trust it */}
        <section className="py-8 border-t border-[#3C3A58]/30">
          <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-center mb-8">Why trust it with your outreach</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {TRUST_POINTS.map((point) => (
              <div key={point.title} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
                <h3 className="font-medium text-[#EDEAF8] mb-1">✓ {point.title}</h3>
                <p className="text-sm text-[#8A88A8]">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to start */}
        <section className="py-16 text-center border-t border-[#3C3A58]/30">
          <h2 className="font-['Space_Grotesk'] font-bold text-2xl mb-3">How to start</h2>
          <p className="text-[#8A88A8] mb-6 max-w-md mx-auto">
            Create an account, connect your Gmail, and describe who you sell to — your first campaign can be live
            in minutes, with a 14-day free trial and no card required.
          </p>
          <Link href="/signup" className="inline-block bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-6 py-3 rounded-xl font-semibold">
            Start your free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#3C3A58]/30 mt-8">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8A88A8]">
          <span>© AI Workforce</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[#EDEAF8]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#EDEAF8]">Privacy</Link>
            <Link href="/security" className="hover:text-[#EDEAF8]">Security</Link>
            <Link href="/apply" className="hover:text-[#EDEAF8]">Design partners</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
