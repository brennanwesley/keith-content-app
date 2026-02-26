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
- `CORS_ORIGINS` (comma-separated list, include your Vercel URL)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Health Check
- Endpoint: `/health`
- Expected response: `{ "status": "ok" }`

## Notes
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend.
- After frontend deploy, update `CORS_ORIGINS` with your Vercel production domain.
