// Real, functional webhook alerting (Phase 24) — genuinely fires an HTTP
// POST when configured, no-ops safely when it isn't. Works with any
// webhook-shaped receiver (Slack incoming webhooks, Discord, a custom
// endpoint) since the payload is plain JSON, not vendor-specific.
export async function sendAlert(event: string, details: Record<string, unknown>): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[AI Workforce] ${event}: ${JSON.stringify(details)}`,
        event,
        details,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // An alert that fails to send must never break the job it's
    // reporting on — this is best-effort notification, not a dependency.
  }
}
