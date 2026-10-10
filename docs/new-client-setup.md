# New Client Setup Guide

This codebase is the EmuSport competition management platform. It gives any sporting association a complete in-house system — registrations, fixtures, live scoring, official management, payroll, and paid public sessions.

This guide walks through spinning up a new instance for a new client from scratch.

---

## What's Included

| Feature | Description |
|---|---|
| **Competition management** | Multiple competitions, divisions, and seasons. Automatic draw, finals bracket. |
| **Live scoring** | Officials portal with real-time match events (goals, cards, fouls). Public live view. |
| **Standings & results** | Auto-calculated ladder, match history, team pages. |
| **Player management** | Registration, bulk CSV import, suspension tracking. |
| **Official management** | Accounts, bank details, game fee rate card, ABA payroll download. |
| **Paid sessions** | Stripe-powered public booking for casual or training sessions. |
| **Rules document** | Admin-managed content with PDF export. Public accordion viewer. |
| **Sponsors** | Tiered sponsor management (Platinum → Bronze) with logos. |
| **Admin portal** | Full back-office — competitions, teams, fixtures, payroll, sponsors. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS variables for theming) |
| Database | PostgreSQL via Prisma v7 |
| Database host | Railway |
| App host | Vercel |
| Payments | Stripe (session booking, webhooks) |
| Auth | Custom token-based (bcrypt + DB sessions, 30-day expiry) |
| Email | Nodemailer (booking confirmations) |

---

## Checklist Overview

```
[ ] 1. Fork / duplicate the repo
[ ] 2. Apply client branding (colours, logo, name)
[ ] 3. Provision Railway database
[ ] 4. Set Vercel environment variables
[ ] 5. Deploy to Vercel (preview or production)
[ ] 6. Seed the first admin user
[ ] 7. Set up Stripe (if sessions are needed)
[ ] 8. Configure Stripe webhook
[ ] 9. First login — create venue, courts/fields, competition
```

---

## Step 1 — Fork / Duplicate the Repo

Create a new private GitHub repo for the client. Do **not** fork publicly — use GitHub's "Import repository" or duplicate:

```bash
# Clone the template
git clone https://github.com/emutel/wagga-futsal.git acme-sport
cd acme-sport

# Point to the new client repo
git remote set-url origin https://github.com/emutel/acme-sport.git
git push -u origin main
```

---

## Step 2 — Apply Client Branding

All branding lives in two places. No Tailwind config changes needed.

### 2a. Colours — `app/globals.css`

Find the `:root` block at the top of the file and replace the brand and navy values:

```css
:root {
  /* ✏️  Primary action colour — buttons, links, accents */
  --color-brand:       #E91E8C;   /* replace with client's primary colour */
  --color-brand-dark:  #C0166F;   /* ~15% darker — hover states */
  --color-brand-light: #F472B6;   /* ~20% lighter — subtle fills */

  /* ✏️  Dark background / heading colour */
  --color-navy:        #0D1B2E;   /* replace with client's dark colour */
  --color-navy-mid:    #1A2E4A;
  --color-navy-light:  #243B55;

  /* Leave these unless the client has specific requirements */
  --color-background: #ffffff;
  --color-foreground: #0D1B2E;
  --color-muted:      #6B7280;
  --color-border:     #E5E7EB;
  --color-live:       #10B981;
  --color-live-bg:    #D1FAE5;
}
```

**Tip:** Use [oklch.com](https://oklch.com) or [coolors.co](https://coolors.co) to generate dark/light variants from the client's primary hex.

### 2b. Logo — `public/logo.png`

Replace `public/logo.png` with the client's logo. It appears in:
- Admin sidebar (36×36px display — keep source square or circular)
- Public header (~32px height)

PNG with a transparent background works best. If it's a light logo, it will show correctly against the dark nav background.

### 2c. Organisation Name

Search for the existing organisation name and replace it throughout:

```bash
# Find all occurrences
grep -r "Wagga Futsal\|WAGGA FUTSAL" --include="*.tsx" --include="*.ts" .
```

Key files to update:

| File | What to change |
|---|---|
| `app/(admin)/layout.tsx` | Sidebar header name and sub-label |
| `app/(public)/layout.tsx` | Public nav bar name |
| `app/(public)/page.tsx` | Homepage hero text |
| `app/layout.tsx` | Default `<title>` metadata |

---

## Step 3 — Provision Railway Database

Each client gets their own isolated Railway project and PostgreSQL database.

1. Go to [railway.app](https://railway.app) → **New Project**
2. Add a **PostgreSQL** service
3. Click the database → **Variables** tab → copy `DATABASE_URL`
4. In your local `.env`, set:
   ```
   DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway
   ```
5. Push the schema to the new database:
   ```bash
   npx prisma db push
   ```
   This creates all tables. Safe to run on a fresh database — no migrations needed.

---

## Step 4 — Vercel Environment Variables

In the Vercel dashboard for the new project, add these under **Settings → Environment Variables**:

| Variable | Where to get it | Required |
|---|---|---|
| `DATABASE_URL` | Railway → PostgreSQL → Variables | ✅ |
| `AUTH_SECRET` | Generate: `openssl rand -hex 32` | ✅ |
| `NEXT_PUBLIC_APP_URL` | Your Vercel preview URL or custom domain | ✅ |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | Sessions only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys | Sessions only |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks (step 8) | Sessions only |
| `BANK_DETAILS_KEY` | `openssl rand -base64 32` (keep it secret; losing it means re-entering referees' bank details) | Always: encrypts referees' bank details |
| `SMTP_HOST` | Email provider | Booking emails only |
| `SMTP_PORT` | Email provider | Booking emails only |
| `SMTP_USER` | Email provider | Booking emails only |
| `SMTP_PASS` | Email provider | Booking emails only |
| `SMTP_FROM` | e.g. `noreply@acmesport.com.au` | Booking emails only |

Apply all variables to **Production**, **Preview**, and **Development** environments.

---

## Step 5 — Deploy to Vercel

```bash
# Link the repo to a new Vercel project
npx vercel --yes

# Or push to GitHub and connect via the Vercel dashboard
git push origin main
```

Vercel auto-detects Next.js. The build command is `npm run build` (runs `prisma generate && next build`).

For a **client preview** before they commit: use the Vercel preview URL — it's live immediately after deploy, no custom domain needed.

---

## Step 6 — Seed the First Admin User

There is no admin signup UI by design. Create the first admin via a one-off script:

```bash
# Set the target database first
$env:DATABASE_URL = "postgresql://..."   # PowerShell
# export DATABASE_URL="postgresql://..."   # bash/zsh

npx tsx -e "
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.create({
    data: { name: 'Admin', email: 'admin@acmesport.com.au', passwordHash: hash, role: 'ADMIN' }
  });
  console.log('Admin created');
}
main().finally(() => prisma.\$disconnect());
"
```

Log in at `/referee/login` with those credentials. The admin portal is at `/admin`.

**Change the password immediately** after first login.

---

## Step 7 — Set Up Stripe (Sessions Only)

Skip this step if the client doesn't use paid public sessions.

1. Create or use an existing Stripe account for the client
2. Copy the API keys into Vercel env vars (step 4)
3. Use **test mode keys** for the preview; switch to **live keys** before go-live

---

## Step 8 — Configure Stripe Webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://your-vercel-url.vercel.app/api/webhooks/stripe`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Vercel

---

## Step 9 — First Login Walkthrough

Once deployed, walk through this with the client (or set it up yourself for a demo):

1. **Admin → Competitions → New** — create a competition (name, season, division, gender)
2. **Admin → Fixtures → Time Slots** — add schedule slots (day, time, court/field, duration)
3. **Admin → Teams** — add teams manually or via CSV import
4. **Admin → Players** — bulk import via CSV if available
5. **Admin → Fixtures → Generate Draw** — auto-generates round-robin fixtures
6. **Admin → Officials** — add official accounts (they get a login for the scoring portal)
7. **Admin → Payroll** — set the game fee rate card (field official / scorer)
8. **Admin → Rules** — paste the competition rules (Markdown supported, PDF export included)
9. **Admin → Sponsors** — upload sponsor logos and assign tiers

---

## Branding Quick Reference

| What to change | File | What to edit |
|---|---|---|
| Primary colour | `app/globals.css` | `--color-brand` and variants |
| Dark colour | `app/globals.css` | `--color-navy` and variants |
| Logo | `public/logo.png` | Replace file (square PNG, transparent bg) |
| Org name (admin) | `app/(admin)/layout.tsx` | Hardcoded in sidebar |
| Org name (public) | `app/(public)/layout.tsx` | Hardcoded in nav |
| Homepage hero | `app/(public)/page.tsx` | Headline and subtext |
| Page title prefix | `app/layout.tsx` | `metadata.title.template` |
| Payroll org name | Admin → Payroll | Set in the payroll form (saved to database) |

---

## Common Issues

**Build fails on Vercel**
- Check `DATABASE_URL` is set in all three environments (Production, Preview, Development)
- Run `npx prisma db push` locally against the new DB before deploying

**"Unauthorized" on admin pages**
- Session cookie not set — log in again at `/referee/login`
- Check `AUTH_SECRET` is set in Vercel env vars

**Sessions not showing on the public site**
- Status must be `OPEN` or `FULL`
- `scheduledAt` must be in the future (or within 3 hours past, for in-progress sessions)

**Stripe payments not confirming**
- Webhook not configured, or `STRIPE_WEBHOOK_SECRET` is wrong
- Check Vercel function logs for `/api/webhooks/stripe`

**Official can't log in**
- Their account must have `role: REFEREE` — create via Admin → Officials

---

## Per-Client Effort Estimate

| Scope | Estimated time |
|---|---|
| Branding only (colours + logo + name) | ~30 min |
| Full setup (DB + Vercel + Stripe + seed) | ~2 hours |
| Initial data entry (competitions, teams, fixtures) | 1–3 hours (varies by size) |
| Custom domain + DNS | ~15 min |
