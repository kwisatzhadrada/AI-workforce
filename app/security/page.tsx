import LegalPage from '@/components/legal/LegalPage'

export const metadata = { title: 'Security Overview — AI Workforce' }

export default function SecurityPage() {
  return (
    <LegalPage title="Security Overview" updated="Launch">
      <p>A summary of how your data is protected. Every claim below reflects the actual, verified architecture of this platform.</p>

      <h2>Authentication &amp; access control</h2>
      <ul>
        <li>Authentication is handled by Supabase Auth. We never see or store your raw password.</li>
        <li>Every database table enforces row-level security — an organization&apos;s data is only ever visible to that organization&apos;s own members, proven by an automated test suite that specifically checks an unrelated outsider account cannot read another organization&apos;s data.</li>
        <li>Sensitive actions (autonomy changes, campaign launches, deal outcomes, billing changes) are recorded in a real audit trail, visible to your organization&apos;s own managers and admins.</li>
      </ul>

      <h2>Your connected accounts</h2>
      <p>Gmail is connected via Google&apos;s own OAuth consent screen — we never see or store your Google password, only a scoped access token you can revoke at any time from your Google Account settings. HubSpot and Hunter.io credentials are only visible to your organization&apos;s managers and admins.</p>

      <h2>Sending safety</h2>
      <ul>
        <li>Every organization has a daily email send cap, enforced at the database layer before any real send happens.</li>
        <li>The same contact is never emailed twice across separate campaign runs.</li>
        <li>Every send is logged to the audit trail.</li>
      </ul>

      <h2>Infrastructure</h2>
      <p>Hosted on Vercel (application) and Supabase (database, Postgres 16). Billing is handled entirely by Stripe — we never store your card number ourselves. Background jobs run through a scoped credential used only inside one server-side route, never reachable from a browser.</p>

      <h2>What we&apos;re honestly still working on</h2>
      <p>We&apos;d rather tell you this than let you assume it&apos;s already solved:</p>
      <ul>
        <li>Integration credentials are not yet encrypted at rest (they are access-restricted as above, but not additionally encrypted) — planned.</li>
        <li>Alerting is not yet push-based — our team checks monitoring dashboards today; real-time alerting is planned.</li>
        <li>An independent backup schedule outside our database provider is not yet in place.</li>
      </ul>

      <h2>Reporting a security concern</h2>
      <p>If you believe you&apos;ve found a security issue, contact us directly through the in-app support widget rather than filing it as public feedback.</p>
    </LegalPage>
  )
}
