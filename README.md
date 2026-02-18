# LedgerLift - Nuxt 3 Expense Tracker with AI Suggestions

LedgerLift is a full-stack Nuxt project that includes:

- User auth (register, login, logout, current session)
- Expense tracking (create, list, update, delete)
- AI suggestions endpoint for spend optimization
- Rule-based fallback suggestions when no AI key is configured

## Stack

- Nuxt 3 full-stack runtime (Vue + Nitro API routes)
- Cookie-based auth with signed session tokens
- File-based persistence in `data/store.json`
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
- `OPENAI_API_KEY`: optional; enables live AI suggestions
- `OPENAI_MODEL`: optional; defaults to `gpt-4o-mini`

3) Run development server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Expenses

- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

### AI

- `GET /api/ai/suggestions`

## Production

```bash
npm run build
npm run preview
```

## Notes

- Data is persisted locally in `data/store.json`.
- For production, replace the file store with a real database and rotate a strong `JWT_SECRET`.
