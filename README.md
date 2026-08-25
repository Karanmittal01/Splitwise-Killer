# Splitwise Killer

A self-hosted Splitwise alternative. Sign in with Google or an email and
password, split bills with people who don't have an account yet, and settle up — everything rendered and computed
on the server, everything free to run.

```
Next.js 16 (App Router, Server Components + Server Actions)
Auth.js v5 — Google, plus email and password
Postgres via Prisma 7
Tailwind CSS v4
```

---

## What it does

**Money**

- Split **equally**, by **exact amounts**, by **percentage**, by **shares**, or
  equally **with adjustments** (+/− per person)
- **More than one person can pay** for the same bill
- **20 currencies**, tracked separately — no invented exchange rates, and
  zero-decimal currencies (¥) are handled properly
- Every amount is stored as an integer number of minor units, so the split of a
  ₹1,000 bill three ways adds back up to exactly ₹1,000
- **Settle up** with full or partial payments, prefilled from any balance row
- **Simplify debts** per group: collapses a tangle of IOUs into the fewest
  possible transfers without changing anybody's net position

**People**

- **Google sign-in** — nothing to remember, nothing to reset
- **Or an email and a password**, for anyone who would rather not involve
  Google. Joined with Google and want a password too? *Account → Password*
  adds one; either way in then works
- **Invite by email or mobile number.** People you add exist immediately as
  placeholder accounts holding real balances. When they sign in with Google
  using that email, the account is theirs. Invited by phone, or signed up with
  a different address? The invite link merges the placeholder into their real
  account, balances and history included
- **Mobile numbers are canonicalised**, so `9876543210`, `+91 98765 43210` and
  `098765 43210` are one person rather than three. Set `DEFAULT_COUNTRY_CODE`
  for the dialling code to assume (default `91`)
- **Mobile invites go out over WhatsApp, SMS or the system share sheet** —
  addressed to that person's number, sent from your own phone. No SMS gateway,
  no per-message cost
- **Email invites are sent by the server**, on adding somebody and again
  whenever you tap ✉️ on their page — no half-written draft handed back to you
  in your own mail app. Capped at a few re-sends an hour per person
- **Private nicknames** for anybody on your list — only you see them, and their
  own name and picture update themselves when they sign in
- **Import from your contacts**: the native picker on Android Chrome, or a
  `.vcf` export anywhere else. Parsed on the device; only the people you tick
  are sent
- Friends list with running one-on-one balances, plus shareable group links

**Day to day**

- Groups (trip / home / couple / friends / other) with icons, per-group
  currency, archiving, and a group ledger with search, category filter and
  **CSV export**
- **Recurring expenses** (weekly → yearly), created automatically when due —
  no cron job, no paid scheduler
- **Receipts** (image or PDF, stored in your database), **comments**, notes,
  38 categories with automatic guessing from the description
- **Activity feed** with unread badge and full-text search
- **Share a friend's history** to WhatsApp, choosing which transactions go in
- **Personal notes**: private records of money that is not coming back, kept
  out of every balance and invisible to the other person
- **Contact page** with a feedback form and an optional donation link
- **Light / dark / system theme**, stored in a cookie and applied server-side
  so there is no flash of the wrong palette
- Responsive: sidebar on desktop, tab bar and floating add button on mobile,
  automatic dark mode, installable as a home-screen app

---

## Run it locally

You need Node 20+ and a Postgres database.

```bash
git clone <this repo>
cd Splitwise-Killer
npm install

cp .env.example .env          # then edit DATABASE_URL and AUTH_SECRET
npx auth secret               # generates AUTH_SECRET for you

npm run db:push               # create the tables
npm run db:seed               # optional: demo people, groups and expenses
npm run dev
```

Open http://localhost:3000.

With `ALLOW_DEV_LOGIN="true"` the login page shows a plain email box so you can
click around before setting up Google. That shortcut is compiled out of
production builds — it checks `NODE_ENV` as well as the flag — so it can never
become a back door on a deployed site.

Seeded demo accounts: `demo.alex@example.com`, `demo.sam@example.com`,
`demo.riya@example.com`.

---

## Setting up Google sign-in

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and
   create a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the
   app name and your support email, and save. While it is in *Testing* mode,
   add the Google accounts you want to let in under *Test users*; press
   *Publish app* when you want it open to everyone.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorised JavaScript origins: `http://localhost:3000`
     (and later `https://your-domain.com`)
   - Authorised redirect URIs:
     `http://localhost:3000/api/auth/callback/google`
     (and later `https://your-domain.com/api/auth/callback/google`)
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` and
   `AUTH_GOOGLE_SECRET`, then restart the dev server.

That's the whole setup, and it costs nothing.

> **A note on account linking.** Google is configured with
> `allowDangerousEmailAccountLinking`. That is deliberate: it is what lets
> somebody who was invited by email walk straight into the balances waiting for
> them. It is safe here because Google only ever hands us verified addresses,
> and Google is the only provider configured.

---

## Passwords

Passwords are hashed with **scrypt** from Node's own `crypto` — no native
module to build, nothing to install, and the cost parameters are stored
alongside each hash so they can be raised later without locking anybody out.
The plain password is never written down or logged.

Auth.js can't do password sign-in on the database session strategy, so
`src/lib/auth-session.ts` mints the session itself: the same `Session` row and
the same cookie Auth.js would have written. Everything downstream — `auth()`,
`signOut()`, session expiry — is unchanged.

**One rule is worth knowing.** An email address that has already been invited
here owns real balances before anybody has ever signed into it. If signing up
with a password could claim those on the spot, knowing a friend's email address
would be enough to read their expenses. So that one case is held behind a
confirmation email (`RESEND_API_KEY`); the address is only handed over once the
link in it is opened. Signing up with an address nobody has mentioned has
nothing to hand over, so it goes straight through.

If email isn't configured, that sign-up is refused rather than waved through —
the invite link or Google sign-in are the ways in.

---

## Deploying (free)

The stack is designed for a free hosting tier — one Node process and one
Postgres database, no object storage, no queue, no cron.

**Database.** Create a free Postgres on [Neon](https://neon.tech) (or Supabase,
or Vercel Postgres) and copy the pooled connection string.

**App.** Push to GitHub and import the repo on [Vercel](https://vercel.com).
Set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Postgres connection string |
| `AUTH_SECRET` | output of `npx auth secret` |
| `AUTH_URL` | your public URL, e.g. `https://split.karanmittal.com` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from the step above |
| `RESEND_API_KEY` / `RESEND_FROM` | optional, for invite emails |
| `RESEND_API_URL` | optional; point mail delivery at a stub or your own relay |

The build command (`prisma generate && prisma db push && next build`) creates
the database tables for you on the first deploy, so there is nothing to run by
hand.

Any Node host works just as well — `npm run build && npm start` behind a
reverse proxy on a VPS, Railway, Render, Fly.io, or a Docker container.

### Putting it on your own domain

Once it's deployed, adding `karanmittal.com` (or a subdomain like
`split.karanmittal.com`) is three steps:

1. Add the domain in your host's dashboard and create the DNS record it asks
   for (usually a `CNAME` for a subdomain, or `A`/`ALIAS` for the apex).
2. Update `AUTH_URL` to the new origin and redeploy.
3. Add the new origin and `https://<domain>/api/auth/callback/google` to the
   Google OAuth client from the setup above.

Nothing in the code is tied to a hostname, so no code changes are needed.

---

## Tools (optional)

A **Tools** section in the sidebar, holding personal automations. It appears only
for the signed-in account whose email matches `OWNER_EMAIL`, and every page and
API route under it 404s for anybody else — so on a deployment somebody else runs,
it does not exist.

The one tool so far buys the monthly ₹1,000 Amazon Pay gift card on the Amex
Shopwise portal. You tap *Buy* and send the two OTPs; everything else happens on
its own.

Driving a third-party checkout needs a real browser held open for minutes, which
a serverless function cannot do — so the automation lives in a **separate worker
process** ([AmEx-Shopwise](https://github.com/Karanmittal01/AmEx-Shopwise)) that
polls this app for work:

```
/tools/shopwise  ──► ShopwiseJob row ◄── worker polls, drives the portal
      ▲                                        │
      └──────── OTP you type, relayed ─────────┘
```

The worker only ever calls out, so it can sit on a Raspberry Pi or a small VPS
with no inbound access. **Card details never reach this app or its database** —
they stay encrypted on the worker. `ShopwiseJob` holds only amounts, phases,
order references, and an OTP that is deleted the instant the worker collects it.

To enable it:

```bash
OWNER_EMAIL="you@example.com"                   # who sees Tools
SHOPWISE_WORKER_TOKEN="$(openssl rand -hex 32)" # shared secret for the worker
```

Leave `SHOPWISE_WORKER_TOKEN` empty and every worker request is rejected, which
switches the tool off without removing it.

---

## Tests

```bash
npm test           # money, split and balance maths (node:test, no browser)
npm run test:e2e   # full user journeys in a real browser (Playwright)
```

The e2e suite signs in, builds a group, splits bills five different ways,
settles up, claims an invite as a second account, uploads a receipt and checks
the CSV export. It needs a running database and `ALLOW_DEV_LOGIN="true"`.

To eyeball the UI, `npx playwright test screens` writes a screenshot of every
page to `screenshots/`.

---

## How it fits together

```
prisma/schema.prisma      the data model
src/lib/
  money.ts                integer-cents arithmetic and formatting
  split.ts                the five split methods, one shared parser for both
                          the live preview and the server action
  balances.ts             who owes whom, per currency + debt simplification
  people.ts               placeholder accounts, invites, account merging
  queries.ts              read models for each screen
  auth.ts / session.ts    Auth.js wiring and the current user
src/server/actions/       every mutation (server actions, validated with zod)
src/app/                  routes — all server-rendered
src/components/           UI; only the expense form and small widgets are
                          client components
```

A few decisions worth knowing about:

- **Money is never a float.** Everything is integer minor units, and the split
  helpers guarantee the parts sum back to the total (the odd cent goes to the
  first names, exactly like Splitwise).
- **A settlement is just an expense** with `isPayment = true`, where the sender
  paid and the receiver owes. One code path covers balances, activity and
  history for both.
- **Balances are derived, never stored.** Every screen recomputes from the
  share rows, so a corrected expense can't leave a stale balance behind.
- **Recurring expenses are materialised lazily** when a member opens the app,
  which is what keeps the hosting free.

---

## Licence

MIT — do what you like with it.
