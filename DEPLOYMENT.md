# Deployment Guide

## Local Development

Local development must continue to use the local PostgreSQL database on the laptop.

Keep `.env` local and do not commit it:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lms_operations_platform?schema=public"
```

Run locally:

```bash
npm run dev
```

Local development uses local PostgreSQL only. Do not point local development to Neon.

## Render Online Testing/Demo

Render must use its own environment variables from the Render dashboard.

In Render, set:

```env
DATABASE_URL=<Neon PostgreSQL connection string from Neon>
```

Do not commit the Neon connection string to GitHub.

Final Render commands:

Build command:

```bash
npm install && npx prisma generate && npm run build
```

Start command:

```bash
npm run start
```

After changing Render environment variables:

1. Save the environment variable changes.
2. Go to Manual Deploy.
3. Choose Deploy latest commit.

## Demo Logins

Use these accounts for online testing:

```text
admin@jawraa.demo / test1234
stakeholder@jawraa.demo / test1234
dataentry@jawraa.demo / test1234
customer@jawraa.demo / test1234
```

## Safety Rules

- `.env` is for local development only.
- Render uses `DATABASE_URL` from the Render dashboard only.
- Do not commit real database credentials.
- Do not run `npm run seed:demo-clean` against Neon or production databases.
- The clean demo reset script is guarded for localhost and is intended for local/demo use only.
