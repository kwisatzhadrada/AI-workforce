import { EmailProvider, IntegrationConfigError, ReplyCheckResult, SendEmailResult } from './types'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type GmailCredentials = {
  refreshToken: string
  email: string
}

// Gmail integration via standard OAuth2 (Authorization Code + refresh
// token) against the real Gmail REST API — the same integration path a
// real business would set up, not a stand-in. Requires GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET (see .env.example and the connect/callback routes
// under app/api/integrations/gmail). Every access token is short-lived,
// so every call here refreshes first rather than caching a token that
// might already be expired.
export class GmailEmailProvider implements EmailProvider {
  name = 'gmail' as const

  constructor(private credentials: GmailCredentials) {}

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new IntegrationConfigError('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured')
    }
    if (!this.credentials?.refreshToken) {
      throw new IntegrationConfigError('Gmail is not connected for this organization')
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gmail token refresh failed (${res.status}): ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    return data.access_token as string
  }

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<SendEmailResult> {
    const accessToken = await this.getAccessToken()

    const mime = [
      `From: ${this.credentials.email}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      params.body,
    ].join('\r\n')

    const raw = Buffer.from(mime).toString('base64url')

    const res = await fetch(`${GMAIL_API}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gmail send failed (${res.status}): ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    return { messageId: data.id, threadId: data.threadId }
  }

  async checkReplies(threadId: string, sentMessageId: string): Promise<ReplyCheckResult> {
    const accessToken = await this.getAccessToken()

    const res = await fetch(`${GMAIL_API}/threads/${threadId}?format=metadata&metadataHeaders=From`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gmail thread lookup failed (${res.status}): ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    const messages: { id: string; snippet?: string; internalDate?: string }[] = data.messages || []

    // A reply exists once the thread has any message after the one we sent.
    const sentIndex = messages.findIndex((m) => m.id === sentMessageId)
    const laterMessages = sentIndex >= 0 ? messages.slice(sentIndex + 1) : messages.length > 1 ? messages.slice(1) : []

    if (laterMessages.length === 0) {
      return { hasReply: false, replySnippet: null, repliedAt: null }
    }

    const latest = laterMessages[laterMessages.length - 1]
    return {
      hasReply: true,
      replySnippet: latest.snippet || null,
      repliedAt: latest.internalDate ? new Date(Number(latest.internalDate)).toISOString() : null,
    }
  }
}

export function getGmailOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    throw new IntegrationConfigError('GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI are not configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGmailCode(code: string): Promise<GmailCredentials> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new IntegrationConfigError('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI are not configured')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    throw new Error(`Gmail OAuth exchange failed (${tokenRes.status}): ${body.slice(0, 300)}`)
  }

  const tokenData = await tokenRes.json()
  if (!tokenData.refresh_token) {
    throw new Error('Google did not return a refresh token — remove prior app access at myaccount.google.com/permissions and reconnect')
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = userInfoRes.ok ? await userInfoRes.json() : {}

  return { refreshToken: tokenData.refresh_token, email: userInfo.email || '' }
}
