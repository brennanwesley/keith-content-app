# Vercel Setup (Frontend)

## Project Settings
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (default)

## Required Environment Variables
- `NEXT_PUBLIC_API_BASE_URL` (Render backend URL, no trailing slash)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Notes
- `NEXT_PUBLIC_*` vars are exposed to browser clients by design.
- Keep all server-only keys out of Vercel frontend envs.
- Redeploy frontend after changing environment variables.
