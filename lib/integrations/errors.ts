// Shared error classification + retry for every real HTTP call this
// platform makes to Gmail/HubSpot/Hunter. No new architecture — this is a
// thin wrapper around the same global `fetch` every provider already
// uses, plus a message-mapping function, so a disconnected account,
// an exceeded quota, an invalid token, a rate limit, and a network blip
// all produce a distinct, honest, user-facing sentence instead of a raw
// HTTP status dump — and a transient failure gets one bounded retry
// before it's surfaced, since there's no background worker in this stack
// to retry it later.

export function classifyHttpError(providerLabel: string, status: number, body: string): string {
  if (status === 401 || status === 403) {
    return `${providerLabel} rejected this connection's credentials (${status}) — the token may have been revoked or expired. Reconnect ${providerLabel} from the Integrations tab.`
  }
  if (status === 429) {
    return `${providerLabel} rate limit or quota exceeded (429) — wait a few minutes before retrying, or check your ${providerLabel} plan's usage limits.`
  }
  if (status >= 500) {
    return `${providerLabel} is temporarily unavailable (${status}) — this is on their end, not yours. Try again shortly.`
  }
  if (status === 404) {
    return `${providerLabel} could not find the requested resource (404).`
  }
  return `${providerLabel} request failed (${status}): ${body.slice(0, 300)}`
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Retries only on a network-level failure (DNS, connection reset, timeout)
// or a retryable HTTP status — never on 4xx auth/validation errors, since
// retrying those just wastes the request-timeout budget on a guaranteed
// repeat failure. Bounded to 2 attempts total with a short backoff, since
// this all has to fit inside one inline request/response cycle.
export async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 1): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.ok || !isRetryableStatus(res.status) || attempt === maxRetries) {
        return res
      }
      lastError = new Error(`retryable status ${res.status}`)
    } catch (err) {
      lastError = err
      if (attempt === maxRetries) throw err
    }
    await sleep(300 * Math.pow(3, attempt))
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries')
}

export function describeNetworkError(providerLabel: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return `Could not reach ${providerLabel} (network error) — check your connection and try again. (${message})`
}
