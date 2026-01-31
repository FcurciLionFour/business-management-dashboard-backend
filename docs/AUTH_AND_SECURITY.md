# Auth and Security

**Date:** 2026-01-28  
This document describes authentication, session handling, CSRF, cookies, CORS, and security conventions used by this boilerplate.

---

## 1. Design goals

- Secure-by-default for web apps (SPA/SSR).
- Short-lived access tokens to reduce token theft impact.
- Refresh tokens stored HttpOnly (not readable by JS).
- CSRF protection for cookie-auth endpoints (refresh/logout).
- Multi-session support per user (multiple devices).
- Auditability for sensitive actions.

---

## 2. Token model

### 2.1 Access token (JWT)
- Returned in response **body**.
- Sent by the client via header:
  ```http
  Authorization: Bearer <accessToken>
  ```
- Intended TTL: **10–20 minutes**.

**JWT contract**
- User identifier must be in `sub`.
- Example payload:
  ```json
  {
    "sub": "uuid-of-user"
  }
  ```

**Server normalization (critical)**
JwtStrategy must return:

```ts
validate(payload: { sub: string }) {
  return { sub: payload.sub };
}
```

If you rename it (e.g., `userId`), you must update every guard/service/decorator. This boilerplate standardizes on `sub`.

### 2.2 Refresh token
- Stored in **HttpOnly cookie** `refresh_token`.
- Rotated at every refresh.
- Stored hashed in DB (`AuthSession.hashedRefreshToken`).
- Intended TTL: **7 days** (adjustable).

**Why hashed?**
If DB is leaked, raw refresh tokens must not be usable.

---

## 3. Session model (AuthSession)

Each login creates or updates a session record that tracks refresh token state.

### 3.1 Recommended fields
- `hashedRefreshToken` (required)
- `expiresAt` (required)
- `revokedAt` (nullable)
- `ip` / `userAgent` (optional)
- rotation links: `replacedById` / `replacements`

### 3.2 Rotation model (conceptual)
On refresh:
1. Validate CSRF token
2. Read refresh cookie
3. Verify it matches hashed token in DB
4. Issue new refresh token
5. Mark old session revoked/replaced
6. Return new access token + set new refresh cookie

If token reuse is detected:
- revoke sessions
- return 401

---

## 4. CSRF protection

### 4.1 Why CSRF is required
Because refresh/logout rely on cookies and browsers automatically attach cookies, cross-site requests are possible without CSRF protection.

### 4.2 Double submit cookie
- Server sets `csrf_token` cookie (not HttpOnly).
- Client reads cookie and sends header `x-csrf-token` with the same value.
- Server verifies cookie and header match.

### 4.3 CSRF bootstrap endpoint
- `GET /auth/csrf` (must be `@Public()`)
- Sets `csrf_token` cookie

### 4.4 Endpoints requiring CSRF
- `POST /auth/refresh`
- `POST /auth/logout`
- Any other future cookie-auth endpoints

### 4.5 Expected errors
- Missing CSRF header: `403` (`CSRF token missing`)
- Invalid CSRF: `403`

---

## 5. Cookies: correct settings

### 5.1 Refresh cookie
Recommended:
- `httpOnly: true`
- `secure: true` in production
- `sameSite`:
  - `lax` (same-site deployments)
  - `none` + `secure: true` (cross-site deployments)
- `path`: restrict to refresh/logout endpoints if desired

### 5.2 CSRF cookie
Recommended:
- `httpOnly: false` (must be readable by JS)
- `secure: true` in production
- `sameSite`: align with refresh cookie choice

---

## 6. CORS (cross-domain)

If frontend and backend are on different origins:
- enable CORS with:
  - `origin: <frontend origin>` (exact, not `*`)
  - `credentials: true` (required for cookies)
- do not allow wildcard origin with credentials

Postman note:
- Postman is not a browser. CSRF/CORS behavior differs. Validate in real browser too.

---

## 7. Unauthorized vs Forbidden

- **401 Unauthorized**: missing/invalid authentication (no/invalid access token)
- **403 Forbidden**: authenticated but not allowed (permission or scope denied)

This boilerplate enforces:
- Missing auth for permission-protected endpoints → 401
- Missing required permissions/roles → 403
- Ownership violation → 403

---

## 8. Password storage

- Passwords must be hashed with bcrypt (or argon2 if adopted later).
- Never return password hashes.
- Never log passwords.

Recommended bcrypt cost:
- Dev: 10
- Prod: 12+ (validate latency budgets)

---

## 9. Audit logging (security)

Audit logs should capture:
- actor (user id or null)
- action (string key)
- entity + entityId
- request context (method/path/ip/userAgent/statusCode/requestId)
- metadata (JSON) without secrets

Never store:
- access tokens
- refresh tokens
- passwords

---

## 10. Client flow (webapp)

1. Client calls `GET /auth/csrf` to receive CSRF cookie.
2. Client calls `POST /auth/login` → gets access token body + refresh cookie.
3. Client calls protected endpoints using Authorization header.
4. When access token expires:
   - Client calls `POST /auth/refresh` with header `x-csrf-token` set from cookie.
   - Server rotates refresh cookie and returns new access token.
5. Client calls `POST /auth/logout` (CSRF required) to revoke session and clear cookie.

---

## 11. Debug checklist

If `request.user` is missing:
- Ensure `Authorization: Bearer <accessToken>` exists
- Ensure JwtStrategy returns `{ sub: payload.sub }`
- Ensure route is not annotated `@Public()` unintentionally
- Ensure controller uses `@CurrentUser()`
