# Database Communication (Prisma 6 + PostgreSQL)

**Date:** 2026-01-28

This document describes conventions for data access and safe Prisma usage.

---

## 1. Principles

1. Services/guards/interceptors may use Prisma; controllers should not.
2. Always use explicit `select`/`include` to prevent data leaks.
3. Never return raw Prisma entities; map to DTOs.
4. Never expose sensitive fields: password, hashed refresh token, internal session ids unless needed.

---

## 2. Data model overview

### User
- `id`, `email`, `password`, `isActive`
- Relations:
  - `roles` → `UserRole[]`
  - `sessions` → `AuthSession[]`
  - `auditLogs` → `AuditLog[]` (as actor)

### Role / Permission
- Role: `name` (ADMIN/USER)
- Permission: `key` (`users.read`, ...)
- Join tables:
  - `UserRole`
  - `RolePermission`

### AuthSession
- `hashedRefreshToken` (store hash only)
- `expiresAt`
- `revokedAt`
- `ip`, `userAgent` (optional)
- rotation tracking

### AuditLog
- who/what/where/how/result/correlation
- metadata JSON and indexes for common queries

---

## 3. Query conventions

### 3.1 Prefer findUnique by id
```ts
await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true },
});
```

### 3.2 Never select secrets
Do not select `password` except during login password validation.

### 3.3 Avoid wide reads
For list endpoints, add pagination early for large domains.

---

## 4. Transactions

Use `prisma.$transaction` when multiple related writes must be atomic (session rotation, multi-row creation).

---

## 5. Debug SQL snippets

```sql
-- user roles
SELECT u.email, r.name
FROM "User" u
LEFT JOIN "UserRole" ur ON ur."userId" = u.id
LEFT JOIN "Role" r ON r.id = ur."roleId"
WHERE u.id = '<USER_ID>';

-- effective permissions
SELECT DISTINCT p."key"
FROM "UserRole" ur
JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
JOIN "Permission" p ON p."id" = rp."permissionId"
WHERE ur."userId" = '<USER_ID>';

-- latest audit logs
SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50;
```

---

## 6. Migrations and seed

- Dev: `prisma migrate dev`
- Prod/CI: `prisma migrate deploy`
- Seed: `prisma db seed`

Seed must represent canonical defaults (roles/permissions/admin user policy). Avoid manual prod DB edits.
