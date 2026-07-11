import LegalPage from '@/components/legal/LegalPage'

export const metadata = { title: 'Terms of Service — AI Workforce' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Launch">
      <p>
        AI Workforce (&quot;the Service&quot;) is a B2B sales outreach platform. When you connect your own Gmail
        account, the Service finds prospects, drafts outreach email using AI, and — only after you approve each
        batch — sends that email through your own connected Gmail account. It also tracks replies, meetings, and
        revenue you record.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information when creating an account.</li>
        <li>You are responsible for keeping your login credentials secure.</li>
        <li>An organization&apos;s owner and managers can invite others and control integration connections.</li>
      </ul>

      <h2>Connected third-party accounts</h2>
      <p>
        You may connect Gmail (to send outreach and check replies, via Google&apos;s own OAuth consent), HubSpot (via
        a Private App token you provide), and Hunter.io (via an API key you provide). You are responsible for
        complying with each provider&apos;s own terms, and for the content of any email sent through your connected
        Gmail account.
      </p>

      <h2>Your responsibility for outreach content and volume</h2>
      <p>
        <strong>You control what gets sent.</strong> No email is sent without your explicit approval. The Service
        enforces a daily send cap as a safety measure, but you remain solely responsible for the accuracy and
        legality of your outreach content (including CAN-SPAM, GDPR, and any other applicable law), for obtaining
        any consent required to contact your targets, and for your own Gmail account&apos;s standing with Google.
      </p>

      <h2>Billing</h2>
      <ul>
        <li>Every new organization receives a free trial with no payment method required.</li>
        <li>Paid subscriptions bill monthly in advance through Stripe. We do not store your card details ourselves.</li>
        <li>Upgrade, downgrade, or cancel at any time from the Billing tab. Cancelling stops future billing at the end of the current period.</li>
        <li>Failed payments may result in restricted access until resolved.</li>
      </ul>

      <h2>Data ownership</h2>
      <p>You own the prospect, campaign, and business data created on your organization&apos;s behalf. We do not sell your data to third parties.</p>

      <h2>Acceptable use</h2>
      <p>You may not use the Service to send unsolicited bulk email in violation of applicable law, to harass or defraud recipients, or to circumvent the send-safety controls described above.</p>

      <h2>Disclaimer and limitation of liability</h2>
      <p>
        The Service is provided &quot;as is.&quot; We do not guarantee any particular outreach response rate,
        meeting volume, or business outcome. To the maximum extent permitted by law, our liability for any claim
        relating to the Service is limited to the amount you paid us in the 12 months preceding the claim.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: reach out through the in-app support widget.</p>
    </LegalPage>
  )
}
