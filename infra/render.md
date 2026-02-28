# Render Setup (Backend)

## Service
- **Type:** Web Service
- **Name:** `teachtok-backend` (recommended)
- **Root Directory:** `backend`
- **Environment:** Node

## Build & Start
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

## Required Environment Variables
- `PORT` (Render usually injects this)
- `NODE_ENV=production`
- `CORS_ORIGINS` (comma-separated list, include your Vercel URL)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONSENT_POLICY_VERSION` (default `v1`)

## Optional now / Required when enabling Mux
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

## Health Check
- Endpoint: `/health`
- Expected response: `{ "status": "ok" }`

## Notes
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend.
- Keep `CORS_ORIGINS` explicit in production (no wildcard fallback).
- After frontend deploy, update `CORS_ORIGINS` with your Vercel production domain.
