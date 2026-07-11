import LegalPage from '@/components/legal/LegalPage'

export const metadata = { title: 'Privacy Policy — AI Workforce' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Launch">
      <h2>What we collect</h2>
      <p><strong>Account data:</strong> your name, email, and login credentials (handled by Supabase Auth — we never see your raw password).</p>
      <p><strong>Organization data:</strong> your company details, plus every business record the Service creates on your behalf — prospects, drafted and sent emails, replies, meetings, and revenue you record.</p>
      <p><strong>Connected account data:</strong> a Gmail OAuth refresh token (not your Google password) and any HubSpot/Hunter.io credentials you provide.</p>
      <p><strong>Usage data:</strong> login timestamps and feature usage, to compute your own account&apos;s health and basic aggregate metrics.</p>
      <p><strong>Billing data:</strong> handled by Stripe. We store your subscription status and plan, not your card number.</p>

      <h2>Who we share data with</h2>
      <ul>
        <li><strong>Google (Gmail API)</strong> — to send email and check replies through your connected account.</li>
        <li><strong>HubSpot</strong> and <strong>Hunter.io</strong> — only if and when you connect them.</li>
        <li><strong>OpenAI and/or Anthropic</strong> — prospect names/companies and campaign context, solely to draft outreach and classify replies. Consult their own policies for data retention.</li>
        <li><strong>Stripe</strong> — for billing and payment processing.</li>
      </ul>
      <p>We do not sell your data to advertisers or data brokers.</p>

      <h2>Data retention</h2>
      <p>We retain your data for as long as your account is active. To request deletion, contact us through the in-app support widget.</p>

      <h2>Your rights</h2>
      <p>Depending on your jurisdiction, you may have the right to access, correct, export, or delete your personal data. Contact us through the in-app support widget to exercise these rights.</p>

      <h2>Security</h2>
      <p>See our <a href="/security" className="text-[#6D28D9] hover:underline">Security Overview</a> for how your data is protected.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy; material changes will be communicated via email or an in-app notice before they take effect.</p>
    </LegalPage>
  )
}
