# Bootstrap for a New Web App

**Date:** 2026-01-28  
Step-by-step guide to bring this boilerplate up for a new project.

---

## 1. Prerequisites

- Node.js aligned with repo
- PostgreSQL instance (local Docker or managed)
- npm/pnpm

---

## 2. Clone / template

Prefer template repo. If cloning manually:

```bash
git clone <repo-url> my-backend
cd my-backend
rm -rf .git
git init
git add .
git commit -m "chore: bootstrap from boilerplate"
```

---

## 3. Configure environment

Create `.env` and ensure config keys match `ConfigService` usage.

Example:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/app?schema=public"
JWT_ACCESS_SECRET="replace"
JWT_REFRESH_SECRET="replace"
CSRF_SECRET="replace"
```

If cross-domain cookies are needed:
- configure CORS to allow frontend origin + credentials
- set cookie `sameSite: none` and `secure: true` in production

---

## 4. Install dependencies

```bash
npm install
```

---

## 5. Generate client and run migrations

Development:
```bash
npx prisma generate
npx prisma migrate dev
```

Production/CI:
```bash
npx prisma generate
npx prisma migrate deploy
```

---

## 6. Seed

```bash
npx prisma db seed
```

Seed should create:
- roles: ADMIN, USER
- permissions required by admin endpoints
- role-permission mappings:
  - ADMIN gets admin permissions
  - USER does not get admin permissions by default

Optionally create initial admin user.

---

## 7. Run server

```bash
npm run start:dev
```

---

## 8. Smoke test checklist

### Auth/CSRF
- `GET /auth/csrf` sets csrf cookie
- `POST /auth/login` returns access token + refresh cookie
- `POST /auth/refresh` requires csrf header

### Users (RBAC + scope)
- USER: `/users` → 403
- USER: `/users/me` → 200
- USER: `/users/:self` → 200
- USER: `/users/:other` → 403
- ADMIN: `/users` → 200
- ADMIN: `/users/:any` → 200

---

## 9. Add business modules
Follow `HOW_TO_ADD_CONTROLLERS.md` to avoid breaking the security model.
