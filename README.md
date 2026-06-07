# Sri Chaitanya Dental Care

Full-stack dental clinic website + staff CRM — public landing page and admin dashboard for patients, appointments, billing, and collections.

## What's Included

- **Landing page**: Hero, services, before/after gallery, testimonials, FAQ, booking form, WhatsApp CTA, location map
- **CRM login** at `/admin`: Supabase Auth (JWT); dev fallback when Supabase not configured
- **Dashboard**: Role-aware KPIs, today's appointments, patient queue, follow-up tracker, charts
- **Patients**: 5-stage workflow (Registered → Waiting → In Treatment → Follow-up Required → Completed) + Mark as Completed
- **Appointments**: Calendar + daily scheduler, status management
- **Billing**: B&W invoice PDF, payment editing
- **Collections**: Admin-only revenue charts, CSV export
- **Follow-ups**: Overdue / today / upcoming queue

Staff roles: `admin` (full access) · `staff` (no Collections / financials)

## Stack

React 19 + Vite 7 + TypeScript 5 · Tailwind CSS v4 · wouter SPA routing
Supabase (PostgreSQL + Auth) · Recharts · jsPDF · EmailJS

## Quick Start — Local

```
npm install
cp .env.example .env
npm run dev
```

Visit http://localhost:5173 — landing page at `/`, CRM login at `/admin`.

Dev fallback (no Supabase required): admin@gmail.com / admin123  or  staff@gmail.com / staff123
NOTE: Dev fallback is DISABLED in production builds (import.meta.env.PROD check).

## Environment Variables

VITE_SUPABASE_URL       — Supabase Project Settings → API → Project URL
VITE_SUPABASE_ANON_KEY  — Supabase Project Settings → API → anon public key
VITE_EMAILJS_SERVICE_ID   — (optional) EmailJS booking form
VITE_EMAILJS_TEMPLATE_ID  — (optional) EmailJS booking form
VITE_EMAILJS_PUBLIC_KEY   — (optional) EmailJS booking form

## Database Setup

Run supabase/schema.sql in Supabase Dashboard → SQL Editor → New Query.
Safe to re-run on existing tables (idempotent).

Creates: patients, appointments, treatments, staff_roles tables + indexes + RLS.

## Create Staff Accounts

1. Supabase Dashboard → Authentication → Users → Add User (email + password)
2. Copy the UUID, then run in SQL Editor:

   insert into staff_roles (user_id, role, name)
   values
     ('<uuid>', 'admin', 'Dr. Admin'),
     ('<uuid>', 'staff', 'Reception Staff');

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. vercel.com → New Project → Import repo (Vite detected automatically)
3. Project Settings → Environment Variables → add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
4. Deploy — vercel.json is already included

### Netlify

1. Push to GitHub → Netlify → New site → Import from Git
2. Build command: npm run build  |  Publish directory: dist
3. Site Settings → Environment Variables → add Supabase vars
4. Create public/_redirects:
      /*  /index.html  200

### Self-hosted (nginx)

npm run build
# Copy dist/ to web root

nginx location block:
   location / { try_files $uri $uri/ /index.html; }
   location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }

## GitHub Push

  git init
  git add .
  git commit -m "Sri Chaitanya Dental Care"
  git remote add origin https://github.com/<username>/<repo>.git
  git branch -M main
  git push -u origin main

## Scripts

  npm run dev        — Start dev server (localhost:5173)
  npm run build      — Production build to dist/
  npm run preview    — Preview production build locally
  npm run typecheck  — TypeScript type check

## Key Files

  src/lib/auth.ts              Login / logout / session / RBAC
  src/lib/supabase.ts          Supabase client
  src/pages/AdminLogin.tsx     Staff login
  src/pages/crm/CRMLayout.tsx  Sidebar + async session guard
  src/pages/crm/Dashboard.tsx  Role-aware KPIs + charts
  src/pages/crm/Patients.tsx   Patient workflow + Mark as Completed
  src/pages/crm/Billing.tsx    B&W invoice PDF
  src/pages/crm/Collections.tsx  Admin-only revenue
  supabase/schema.sql          DB schema + migrations
  .env.example                 Environment variable template
  vercel.json                  Vercel deployment config
