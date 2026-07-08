import Link from 'next/link'
import { SetupWizardState } from '@/lib/setupWizard'

export default function SetupWizardPanel({ state }: { state: SetupWizardState }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">Campaign Setup</h2>
          <span className="text-sm text-[#8A88A8]">{state.completedCount}/{state.totalCount} done</span>
        </div>
        <p className="text-xs text-[#8A88A8]">
          Everything below composes existing actions — connecting an integration, approving a goal plan, running a
          task — into one checklist. There is nothing here you can&apos;t already do from the Integrations, Goals, and
          Tasks tabs directly.
        </p>
      </div>

      <div className="space-y-2">
        {state.steps.map((step, i) => (
          <div key={step.key} className="flex items-start gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                step.done ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#121428] text-[#8A88A8] border border-[#3C3A58]'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#EDEAF8]">{step.label}</div>
              <div className="text-xs text-[#8A88A8] mt-0.5">{step.detail}</div>
            </div>
            {!step.done && (
              <Link
                href={step.actionHref}
                className="text-xs bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-3 py-1.5 rounded-lg font-medium shrink-0"
              >
                {step.actionLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
