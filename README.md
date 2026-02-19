# Diff Expense Tracker - Nuxt 3 with AI Expense Coach

Diff Expense Tracker is a full-stack Nuxt project that includes:

- User auth (register with email + username, login, logout, current session)
- Login "Remember me" session option and register confirm-password check
- Expense tracking (create, list, update, delete)
- Month-based tracking with locked month close workflow
- Optional monthly income + savings target planning
- AI expense coach (question-based, relevance-filtered)
- Rule-based fallback advice when no AI key is configured
- Currency support with user preference (`USD` and `THB`)
- Financial chart layer (monthly trend, daily spend, category distribution)
- Custom responsive controls (hybrid dropdown + calendar with theme-aware glass UI)
- Public landing page and dedicated auth/dashboard routes

## Stack

- Nuxt 3 full-stack runtime (Vue + Nitro API routes)
- Tailwind CSS design system with switchable themes (Ember, Dark Neon, Mint Light)
- Cookie-based auth with signed session tokens
- Neon Postgres + Drizzle ORM persistence
- OpenAI Chat Completions API (optional)

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Configure environment variables

Create `.env` from `.env.example`.

- macOS/Linux: `cp .env.example .env`
- Windows (PowerShell): `Copy-Item .env.example .env`

Then edit `.env`:

- `JWT_SECRET`: required for secure sessions
- `DATABASE_URL`: required for Postgres access
- `OPENAI_API_KEY`: optional; enables live AI suggestions
- `OPENAI_MODEL`: optional; defaults to `gpt-4o-mini`

3) Run database migrations

```bash
npm run db:migrate
```

4) Run development server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## Routes

- `/` - Landing page overview and usage guide
- `/auth` - Sign in / register
- `/dashboard` - Authenticated expense tracker dashboard

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Register request body includes `email`, `username`, `password`, and `confirmPassword`.

New accounts auto-default currency from browser language:

- Thai locale (`th-*`) -> `THB`
- Other locales -> `USD`

### User Preferences

- `PUT /api/user/preferences`

Request body example:

```json
{
  "currencyCode": "THB"
}
```

Supported values are `USD` and `THB`.

### Expenses

- `GET /api/expenses?month=YYYY-MM`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

### Reports

- `GET /api/reports/months`
- `GET /api/reports/monthly?month=YYYY-MM`
- `GET /api/reports/trend?months=8`
- `POST /api/reports/monthly/close`
- `PUT /api/reports/monthly/plan`

### AI

- `POST /api/ai/advice`

Request body:

```json
{
  "month": "2026-02",
  "question": "How much can I spend daily this month if I want to save 300 from my income?"
}
```

Plan request body example:

```json
{
  "month": "2026-02",
  "incomeAmount": 3200,
  "savingsTarget": 600,
  "notes": "Keep discretionary spend lower this month"
}
```

`incomeAmount` must be greater than `0` to save a monthly plan.

### Health

- `GET /api/health`

## Production

```bash
npm run db:migrate
npm run build
npm run preview
```

## Notes

- Data is stored in Postgres via Drizzle migrations (`drizzle/`).
- For production, keep a strong `JWT_SECRET`, and make sure `DATABASE_URL` points to your hosted Postgres database.
- Login/register and AI suggestion endpoints include in-memory rate limiting (good baseline for demos; use Redis for distributed limits).
- Closed months are immutable: expense create/update/delete is blocked once a month is closed.
- AI rejects irrelevant questions and only answers expense/budget-related prompts.
- Income is optional for tracking expenses, but required for daily allowance and savings planning guidance.
- Currency selection changes display formatting only; it does not perform FX conversion.
