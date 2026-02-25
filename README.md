# Keith Content App

Monorepo scaffold for Keith Content App.

- `frontend`: Next.js (TypeScript, App Router, Tailwind, ESLint)
- `backend`: NestJS (TypeScript, ESLint)

## Prerequisites

- Node.js 20+
- npm 10+

## Local setup

1. Install dependencies:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

2. Create local env files:

```bash
copy frontend\\.env.example frontend\\.env.local
copy backend\\.env.example backend\\.env
```

3. Run both apps from the repo root:

```bash
npm run dev
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001` (set `PORT=3001` in `backend/.env`)

## Useful scripts

From root:

- `npm run dev` - run frontend + backend concurrently
- `npm run dev:frontend` - run only frontend
- `npm run dev:backend` - run only backend
- `npm run build` - build both apps
- `npm run lint` - lint both apps