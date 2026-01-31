# RBAC and Scope

**Date:** 2026-01-28

This boilerplate separates:
- **RBAC (roles/permissions)** = capability control (admin features)
- **Scope (ownership)** = resource-level access (self vs others)

This separation prevents common mistakes like blocking self endpoints or duplicating access checks.

---

## 1. Concepts

### Role
High-level grouping: `ADMIN`, `USER`.

### Permission
Fine-grained capability: `users.read`, `users.write`, etc.

### RBAC
Answers: “What can this user do globally?”  
Enforced by `PermissionsGuard`.

### Scope
Answers: “On which specific records can the user operate?”  
Enforced in **services** (not guards).

---

## 2. Canonical policy for Users module

| Endpoint | USER | ADMIN | Enforcement |
|---|---:|---:|---|
| `GET /users` | ❌ 403 | ✅ 200 | RBAC (`users.read`) |
| `GET /users/me` | ✅ 200 | ✅ 200 | Scope/self |
| `GET /users/:id (self)` | ✅ 200 | ✅ 200 | Scope/self |
| `GET /users/:id (other)` | ❌ 403 | ✅ 200 | Scope + admin bypass |
| `POST /users` | ❌ 403 | ✅ | RBAC (`users.write`) |
| `PATCH /users/:id` | ❌ 403 | ✅ | RBAC (`users.write`) |
| `DELETE /users/:id` | ❌ 403 | ✅ | RBAC (`users.write`) |

---

## 3. How RBAC is implemented

### 3.1 When to use permissions
Use permissions for:
- listing all records
- cross-tenant/admin operations
- operations that should never be available to normal users

### 3.2 Applying PermissionsGuard
Apply per controller or per route:
```ts
@UseGuards(JwtGlobalGuard, PermissionsGuard)
```
Then require permissions:
```ts
@RequirePermissions('users.read')
```

### 3.3 Deny-by-default behavior
- If permissions required and no authenticated user → 401
- If user has no roles → 403
- If user missing permission → 403

---

## 4. How scope is implemented

### 4.1 Single helper per resource
Example:
```ts
private async assertCanAccessUser(targetUserId: string, requesterUserId: string) {
  if (await this.isAdmin(requesterUserId)) return;
  if (targetUserId === requesterUserId) return;
  throw new ForbiddenException('Access denied');
}
```

### 4.2 Do not duplicate checks
Never do:
```ts
await assertCanAccessUser(...);
if (id !== requesterId) throw ForbiddenException();
```
The helper must be the single source of truth.

---

## 5. Seeding policy (default)

- Create roles: `ADMIN`, `USER`
- Create permissions needed by admin endpoints
- Assign permissions only to roles that need them

Recommended default:
- ADMIN: `users.read`, `users.write`
- USER: (none of the admin permissions)

---

## 6. Troubleshooting

### USER can list all users
- Check RolePermission: USER has `users.read`
- Fix seed and remove mapping

### Admin cannot access other ids
- Ownership check duplicated outside helper
- Remove duplicate check and ensure helper has admin bypass first

### requesterId is undefined
- JwtStrategy returned `{ userId }` instead of `{ sub }`
- Standardize on `sub`
