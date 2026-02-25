# Frontend

Next.js frontend for Keith Content App.

## Local development

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Vercel deployment settings

In Vercel project settings:

- **Root Directory:** `frontend`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (default for Next.js)

Set these environment variables in Vercel:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
