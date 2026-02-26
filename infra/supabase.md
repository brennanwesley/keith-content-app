# Supabase Setup

## Project Connection Values
Use your Supabase project settings to obtain:
- Project URL (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`)
- Publishable/Anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) — backend only

## App Mapping
### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend (`backend/.env`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Security Rules
- Never commit real keys to git.
- Never expose service role key to frontend.
- Keep RLS enabled for user-owned tables.

## Initial Checklist
1. Enable email auth provider in Supabase.
2. Confirm RLS is enabled on app tables.
3. Create storage bucket(s) for video/media uploads.
4. Add redirect URLs for local + production auth callbacks.
