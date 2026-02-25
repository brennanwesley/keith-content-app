# Backend

NestJS backend for Keith Content App.

## Local development

```bash
npm install
npm run start:dev
```

## Environment variables

Copy `.env.example` to `.env` and configure:

- `PORT` (default `3000`)
- `CORS_ORIGINS` (comma-separated origins)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Render deployment settings

In Render, create a **Web Service** with:

- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

Set these environment variables in Render:

- `PORT` (Render usually injects this automatically)
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
