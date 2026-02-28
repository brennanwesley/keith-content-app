# Backend

NestJS backend for Keith Content App.

## Local development

```bash
npm install
npm run start:dev
```

## Environment variables

Copy `.env.example` to `.env` and configure:

- `PORT` (default `3001` for local monorepo dev)
- `NODE_ENV` (`development`/`test`/`production`, defaults to `development`)
- `CORS_ORIGINS` (comma-separated origins)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUX_TOKEN_ID` (optional now, required once Mux integration is enabled)
- `MUX_TOKEN_SECRET` (optional now, required once Mux integration is enabled)
- `CONSENT_POLICY_VERSION` (default `v1`, used for parental consent records)

Environment variables are validated at startup.

## Render deployment settings

In Render, create a **Web Service** with:

- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

Set these environment variables in Render:

- `PORT` (Render usually injects this automatically)
- `NODE_ENV=production`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUX_TOKEN_ID` (when enabling Mux upload/playback)
- `MUX_TOKEN_SECRET` (when enabling Mux upload/playback)
- `CONSENT_POLICY_VERSION`

For the full deployment checklist, see `../infra/render.md`.
