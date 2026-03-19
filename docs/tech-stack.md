# Tech Stack

## Frontend

- Vite
- React
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui (or similar)

### Why

- Fast dev server
- Minimal framework overhead
- Great DX
- Full control

---

## Backend

- NestJS
- TypeScript
- REST APIs

### Why

- Scalable architecture
- Modular design
- Strong ecosystem

---

## Database

- PostgreSQL
- Prisma ORM

### Why

- Strong relational model
- Easy querying
- Reliable

---

## Storage

- AWS S3 / Cloudflare R2 / Supabase Storage

Used for:

- Receipt uploads
- Documents

---

## Authentication

- JWT (access + refresh tokens)

---

## Background Jobs

- NestJS Scheduler (initial)
- BullMQ + Redis (future)

Used for:

- Reminder processing
- Notifications

---

## Notifications

- Email (Resend/Postmark)

---

## Hosting

Frontend:

- Vercel / Netlify

Backend:

- Railway / Render / VPS

Database:

- Managed PostgreSQL

---

## Dev Tooling

- Bun (package manager)
- ESLint
- Prettier
- Husky (optional)

---

## Architecture Style

- API-first
- Modular backend
- Client-side rendering frontend
- Stateless services

---

## Key Principles

- Keep it simple
- Avoid over-engineering
- Optimize for iteration speed
