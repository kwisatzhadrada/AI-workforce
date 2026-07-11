# Landing Page Conversion Audit

## The structural finding first

There is no marketing landing page. `app/page.tsx` (`/`) has always been
a pure redirect — to `/login` for a logged-out visitor, to the app itself
for a logged-in one. It renders no content of its own; nothing about the
product is ever shown before asking someone to sign in or sign up. The
login and signup pages are, in practice, the entire public-facing front
door.

Building an actual separate marketing site is out of this sprint's scope
("no new architecture"). This audit instead evaluates the real front
door — the auth pages — against the four questions the mission asked,
and rewrites their copy in place.

## Before this sprint

| Question | What the copy said |
|---|---|
| Who is this for? | Nothing stated. |
| What problem does it solve? | "Manage your agents" / "Register and manage AI worker identities" — describes a different, abandoned product (an AI agent identity/reputation marketplace from this project's very first phase), not the B2B sales campaign product this platform has actually been since. |
| Why trust it? | Nothing stated. |
| Why sign up? | Nothing stated beyond the generic form itself. |

The page `<title>` and meta description — what actually shows in a
browser tab, a search result, or a link preview, i.e. the copy furthest
outside the product that a stranger would ever see — had the same
problem: "AI Workforce – Agent Identity Layer... Give every AI worker a
verifiable identity: skills, credentials, reputation, wallet, and
performance history." A prospective design partner googling their way in,
or seeing a shared link, would form a first impression about a completely
different, unrelated product.

## After this sprint

| Question | What the copy now says |
|---|---|
| Who is this for? | Implicit in the mechanism described (a business that does B2B outreach and wants it run for them) — see "weak messaging remaining" below for why this isn't yet explicit. |
| What problem does it solve? | Signup H1: **"An AI sales team that books meetings."** Subtitle: **"Finds real prospects, writes real outreach, sends from your own Gmail, and tracks replies through to a booked meeting."** One sentence, the real mechanism, no jargon. |
| Why trust it? | Two short trust lines added to signup: **"Your Gmail, not a shared sender"** and **"You approve every email"** — the two things a skeptical first-time visitor would actually worry about (deliverability/reputation risk, losing control of outbound messaging) answered directly. |
| Why sign up? | The mechanism description doubles as the pitch — no separate "why sign up" copy exists yet (see below). |

`<title>`/description rewritten to: **"AI Workforce – An AI Sales Team
That Books Meetings"** / *"Deploy an AI sales team that finds prospects,
writes outreach, sends real email, and books real meetings — connected
to your Gmail and CRM in minutes."*

Login page subtitle changed from "Sign in to manage your agents" to
**"Sign in to your AI sales team's workspace"** — consistent with the
same real product, since a returning user doesn't need the full pitch
but shouldn't see contradictory language either.

Verified live (Playwright, real browser, real DOM read — see
`FIRST_TIME_USER_SUCCESS_REPORT.md` for the harness) — every string above
was confirmed rendering exactly as written, not just present in the
source file.

## Weak messaging still remaining (not fixed this sprint)

- **No explicit "who this is for."** The copy describes the mechanism
  well but never names a target buyer (e.g. "for B2B agencies and
  founders doing their own outbound" or similar). Worth A/B testing a
  specific ICP-facing headline variant against the current
  mechanism-first one — a copy change, not a scope violation, reasonable
  for a fast follow-up.
- **No social proof.** No customer logos, quote, or number ("N meetings
  booked for real companies") anywhere on the front door — because there
  are no design partners live yet to reference honestly. This is
  correctly absent rather than fabricated; it should be the first thing
  added the moment there's a real result to point to.
- **No pricing or trial-length signal.** A visitor has no idea if this
  costs anything, what a free trial (if any) includes, or what happens
  after. Reasonable to leave unresolved until the pricing model itself is
  decided — copy can't get ahead of a business decision that hasn't been
  made.
- **The signup form still asks for a password up front**, before any
  value has been shown — every serious SaaS onboarding flow defers this
  friction as late as possible (e.g. magic-link or "start now, set a
  password after"). Real friction, but changing the auth mechanism itself
  is architecture, correctly out of this sprint's scope.
