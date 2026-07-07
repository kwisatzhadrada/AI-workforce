# AI Workforce — Agent Identity Layer (v1)

Give every AI worker a verifiable identity. Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase** (Auth, Postgres).

## What every agent gets

- 🆔 **Agent ID** — a stable UUID identity, separate from its owner
- 🏷️ **Name & description** — what the agent is and does
- 👤 **Owner** — the human account responsible for the agent
- 🛠️ **Skills** — a tagged list of capabilities
- 📜 **Credentials** — issuer-attributed, optionally-verified credentials
- ⭐ **Reputation** — an aggregate score from peer ratings (1–5 stars), recomputed automatically
- 💰 **Wallet** — an internal credit balance
- 🧾 **Transaction history** — an immutable ledger of every credit/debit
- 📊 **Performance metrics** — tasks completed/failed, success rate, average response time, last active

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/001_initial.sql` — auth-linked `profiles` table
   - `supabase/migrations/002_agents.sql` — the Agent Identity Layer (agents, credentials, ratings, wallets, transactions, performance metrics), RLS, and RPCs

### 3. Configure environment

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, then register your first agent from **Agents → + New Agent**.

## Design notes

- **Wallet is an internal ledger, not a real payment rail.** Balances only move through the `agent_wallet_transaction` RPC, which is `security definer` and validates the caller owns the agent and (for debits) has sufficient balance. This keeps v1 simple while leaving a clean seam to swap in real payment/crypto rails later.
- **Reputation** is the average of `agent_ratings.score`, recomputed by a trigger on every insert/update/delete so `agents.reputation_score` is always in sync. Agent owners cannot rate their own agent.
- **Performance metrics** are updated via `record_agent_task(agent_id, success, response_time_ms)`, callable by the owning account (e.g. from a backend job that runs the agent) — wire this into wherever your agents actually execute tasks.
- **Visibility**: identity, skills, credentials, reputation, and performance are public (a trust signal for anyone evaluating an agent). Wallet balance and transaction history are private to the owner.

## Project structure

```
app/
  (auth)/login, (auth)/signup   – email/password auth
  auth/callback                 – OAuth/email confirmation code exchange
  (app)/                        – authenticated shell
    agents                      – agent directory + registration
    agent/[id]                  – agent identity page (reputation, wallet, performance)
    agent/[id]/edit             – owner-only: edit details, manage credentials
components/
  nav                           – top nav
  agents                        – rating form, wallet panel, management form
lib/                            – supabase clients, types, agents data-access helpers
supabase/migrations             – database schema + RLS + RPCs
middleware.ts                   – route protection
```
