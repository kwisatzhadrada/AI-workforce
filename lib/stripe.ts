import Stripe from 'stripe'

// Real Stripe SDK, server-side only — never imported by a client
// component. Lazily constructed so a deployment with no billing
// configured yet (e.g. this project's own sandbox, or a design partner
// evaluating self-hosting) doesn't crash on import; it only throws when
// a billing action is actually attempted.
let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set — billing is not configured on this deployment')
  }
  cached = new Stripe(key)
  return cached
}

export type BillingPlan = 'standard' | 'growth'

export function priceIdForPlan(plan: BillingPlan): string {
  const id = plan === 'growth' ? process.env.STRIPE_PRICE_ID_GROWTH : process.env.STRIPE_PRICE_ID_STANDARD
  if (!id) {
    throw new Error(`STRIPE_PRICE_ID_${plan.toUpperCase()} is not set`)
  }
  return id
}

export function trialDays(): number {
  const raw = process.env.STRIPE_TRIAL_DAYS
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14
}
