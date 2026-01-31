# Architecture

**Date:** 2026-01-28  
**Stack:** NestJS + Prisma 6 + PostgreSQL  
**Audience:** Developers using this boilerplate to build web apps (SPA/SSR) and APIs.

> Goal: provide a backend foundation that you can reuse across projects without touching auth/security core—only adding business modules.

---

## 1. High-level goals

This boilerplate is designed to be:

- **Secure-by-default**: endpoints are protected unless explicitly marked public.
- **Explicit, not magical**: clear guard boundaries, clear decorators, and a single place for resource access decisions.
- **Scalable**: supports multiple roles, granular permissions, session management, audit logs.
- **Maintainable**: avoids duplication of authorization logic; uses consistent data contracts (JWT standard `sub`).

---

## 2. Architectural layers and responsibilities

### 2.1 Request lifecycle overview

A typical request flows through the following layers:

1. **Global authentication** (JwtGlobalGuard)
2. **Route-level authorization** (PermissionsGuard) *(only when applied)*
3. **Controller** (thin; request/response mapping and DTO shaping)
4. **Service** (business logic + **scope/ownership enforcement**)
5. **Persistence** (PrismaService → Postgres)
6. **Cross-cutting**:
   - Audit logging interceptor
   - Exception filters (Nest defaults + any project custom filters)
   - Validation pipes (class-validator / Zod if used)
   - Logging middleware

```
Client → (HTTP)
  → JwtGlobalGuard (global)
  → PermissionsGuard (explicit per controller/route when used)
  → Controller (routing + DTO)
  → Service (business + scope)
  → Prisma (data access)
  → Postgres
  → (response)
```

### 2.2 Controllers

Controllers should be **thin**:

- Parse inputs (params/body/query) and apply DTO validation.
- Use decorators for:
  - `@Public()` for routes that must bypass the global JWT guard.
  - `@UseGuards(JwtGlobalGuard, PermissionsGuard)` where permissions apply.
  - `@RequirePermissions(...)` for administrative capabilities.
  - `@CurrentUser()` to access authenticated user context.
- Delegate all access rules and business rules to services.

**Avoid in controllers:**
- Querying Prisma directly
- Duplicating authorization checks like `if (id !== user.sub) ...`
- Inferring admin status in controllers

### 2.3 Guards

This boilerplate uses **two distinct guard responsibilities**:

#### A) JwtGlobalGuard (Authentication)
- Runs globally on all routes by default.
- Validates the access token.
- Populates `request.user` with a normalized user shape.

**Design principle**: authentication is global, and routes must opt out via `@Public()`.

#### B) PermissionsGuard (Authorization / RBAC)
- Applied explicitly on controllers or routes that require RBAC enforcement.
- Reads metadata from decorators:
  - `@RequirePermissions(...)`
  - `@Roles(...)` *(if used)*
- Queries DB to compute effective permissions based on roles.
- **Deny-by-default**:
  - If permissions are required and there is no authenticated user → **401**
  - If user has no roles → **403**
  - If permissions/roles missing → **403**

**Important**: Guards enforce *capability* (what you can do), not *scope* (what resources you can access).

### 2.4 Services

Services are the **single source of truth** for:

- Business logic
- Resource ownership
- Scope rules (self vs admin vs manager, etc.)
- Data shaping into DTOs

**Rule**: If a decision is about *which resource* a user can access (e.g., a specific `:id`), enforce it in services using a shared helper (e.g., `assertCanAccessUser`).

### 2.5 Prisma / Persistence

Prisma is used purely as a data access layer:

- No permission logic embedded in Prisma queries
- Keep queries explicit (select/include) and controlled
- Never return raw entity objects to controllers—always map to response DTOs

---

## 3. Security architecture summary

This boilerplate combines:

- **JWT access tokens** for request authentication (`Authorization: Bearer <token>`)
- **Refresh tokens in HttpOnly cookies** for session continuity (rotated)
- **CSRF protection** for cookie-based endpoints (double submit cookie)
- **RBAC in DB** for admin and privileged operations
- **Service-level scope enforcement** for ownership rules
- **Audit logs** for traceability

See `AUTH_AND_SECURITY.md` for the exact flows and settings.

---

## 4. Module structure guidelines

Recommended module layout:

```
src/
  auth/
    decorators/
    guards/
    strategies/
    auth.controller.ts
    auth.service.ts
    auth.module.ts
  prisma/
    prisma.service.ts
  audit/
    audit.interceptor.ts
    audit.service.ts
    audit.module.ts
  users/
    dto/
    users.controller.ts
    users.service.ts
    users.module.ts
  modules/
    <business-module>/
      dto/
      <business-module>.controller.ts
      <business-module>.service.ts
      <business-module>.module.ts
```

**Why this layout works**
- `auth` is isolated and reusable.
- `audit` is cross-cutting and easy to apply globally.
- `users` is core domain for identity and admin user management.
- `modules/*` is where client-specific business logic lives.

---

## 5. Core invariants (do not break)

If you want “never touch core again”, keep these invariants:

1. **JWT subject is always `sub`**
2. **Administrative listing endpoints use RBAC**
   - Example: `GET /users` requires `users.read`.
3. **Self/ownership endpoints do not rely on RBAC**
   - Example: `GET /users/:id` is controlled by service scope helper.
4. **All access decisions are centralized**
   - One helper per resource type (User, Project, Operation, etc.)
5. **Deny-by-default behavior**
   - Missing auth/roles/permissions never “falls through”.

---

## 6. Extension model

When you build new features, you will mostly do:

- Add new module in `src/modules/<x>`
- Add a permission key if feature is admin-level (seed it)
- Add a scope helper if feature is ownership-level
- Add controller endpoints with correct decorators
- Add tests (unit for scope helper, e2e for endpoints)

You should **not** need to modify:
- JwtStrategy contract
- Refresh/csrf mechanism
- PermissionsGuard core behavior
- Audit interception mechanism

---

## 7. Common pitfalls and the boilerplate’s answers

### Pitfall: “JWT is global so permissions are global too”
No. PermissionsGuard must be explicitly applied to each controller/route that needs RBAC.

### Pitfall: “Use permissions for self endpoints”
Avoid. Self endpoints belong to scope, not RBAC.

### Pitfall: “Admin cannot access others”
Happens when ownership logic is duplicated outside a shared helper. Keep checks centralized.

---

## 8. Reference documents

- `AUTH_AND_SECURITY.md`
- `RBAC_AND_SCOPE.md`
- `HOW_TO_ADD_CONTROLLERS.md`
- `DATABASE_COMMUNICATION.md`
- `BOOTSTRAP_NEW_WEBAPP.md`
- `BACKEND_TEST_PLAN.md`
