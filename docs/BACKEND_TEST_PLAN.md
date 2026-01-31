# Backend Boilerplate — Visión, análisis y plan de pruebas (Postman)

Fecha: 2026-01-28

Este documento asume el boilerplate NestJS + Prisma 6 + PostgreSQL con:
- JWT access token + refresh token rotativo (cookies HttpOnly)
- Reuse detection / rotación de sesiones (`AuthSession`)
- JwtGlobalGuard (protección global) + `@Public()` para endpoints públicos
- CSRF Double Submit Cookie (`/auth/csrf` + header `x-csrf-token`)
- RBAC (Roles/Permissions en DB) + `PermissionsGuard`
- Audit logging global vía Interceptor hacia `AuditLog`
- `User.isActive` para soft-disable

---

## 1) Visión (qué resuelve este boilerplate)

### Objetivo
Un backend “base” para webapps que:
- **No dependa de hacks** (todo tipado, consistente y auditable).
- Sea seguro por defecto (“secure-by-default”).
- Sea reutilizable en clientes distintos sin reescribir auth/seguridad.
- Permita crecer a roles/permissions complejos sin tocar el core.

### Por qué está bien diseñado
- **Separación de responsabilidades:**
  - Guard JWT: identidad (¿quién sos?)
  - CSRF guard: intención (¿esta acción viene de tu app?)
  - Permissions guard: autorización (¿qué podés hacer?)
  - Service scope: alcance (¿sobre qué recurso aplica?)
  - Interceptor audit: trazabilidad (¿qué pasó?)
- **JWT “liviano”**: no embebe roles; los roles se consultan en DB (evita drift y problemas de revocación).
- **Refresh rotativo por sesión**: permite revocar sesiones, detectar reuse y controlar expiración.
- **CSRF correcto** para escenarios con cookies (webapp real).
- **Audit logs**: base sólida para compliance y debugging.

---

## 2) Análisis (fortalezas y puntos a vigilar)

### Fortalezas (alto impacto)
1. **Refresh rotativo + reuse detection**: evita “refresh token theft” persistente.
2. **CSRF double submit**: estándar para SPA/SSR con cookies; protege refresh/logout.
3. **RBAC real en DB**: roles/permissions flexibles; fácil de extender.
4. **Scope en service**: evita que un permiso genérico exponga recursos de terceros.
5. **Audit logs globales**: evidencia de acciones mutativas, útil para compliance.

### Puntos a vigilar (no son fallas; son decisiones/next steps)
- **Status codes del refresh**: si devuelve 201 (crea sesión nueva) es válido; documentarlo para clientes.
- **Hashing de password en create admin**: ideal que toda creación de usuario pase por AuthService o que UsersService aplique hashing.
- **Rate limiting / brute force**: recomendado como “Opción C” (muy común en producción).
- **Helmet / security headers**: recomendado si se sirve detrás de un gateway o expuesto a internet.
- **CORS y SameSite**: si habrá cross-domain (front y back en dominios distintos), ajustar `sameSite: 'none'` + `secure: true` + CORS con credentials.

---

## 3) Convenciones usadas (para pruebas)

### Cookies esperadas
- `refresh_token`: HttpOnly (rotativo)
- `csrf_token`: NO HttpOnly (double submit)

### Headers esperados
- `Authorization: Bearer <accessToken>` para endpoints protegidos por JWT.
- `x-csrf-token: <csrf_token>` para endpoints mutativos protegidos por CSRF (ej. refresh/logout).

### Roles/Permissions (mínimo)
- Role `ADMIN`: `users.read`, `users.write`
- Role `USER`: `users.read` (y scope limita a self cuando aplique)

---

## 4) Plan de pruebas (Postman) — Checklist con resultados esperados

> Recomendación: crear una colección Postman con variables:
> - `baseUrl`
> - `accessToken`
> - `csrfToken`
> y usar el Cookie Jar de Postman para cookies.

### 4.1 Health / arranque
1) **App levanta**
- Acción: `npm run start:dev`
- Esperado: servidor arriba sin warnings/errores.

2) **DB conectada**
- Acción: endpoint simple que toque Prisma (ej. GET /users con token admin).
- Esperado: 200 + datos.

---

### 4.2 CSRF bootstrap
3) **GET /auth/csrf (público)**
- Acción: `GET {{baseUrl}}/auth/csrf`
- Esperado:
  - 200
  - Cookie `csrf_token` seteada (visible en Postman Cookies)
- Nota: si devuelve 401 => falta `@Public()` o el guard global no respeta `isPublic`.

4) **CSRF header manual (Postman)**
- Acción: copiar el valor de cookie `csrf_token` a variable `{{csrfToken}}`
- Esperado: `{{csrfToken}}` coincide con cookie.

---

### 4.3 Registro / login
5) **POST /auth/register**
- Request body: email/password válidos
- Esperado:
  - 201/200 según implementación
  - access token en body
  - refresh cookie seteada (`refresh_token`)
  - audit log (si el interceptor registra este endpoint)

6) **POST /auth/login**
- Body: credenciales correctas
- Esperado:
  - 200
  - access token en body
  - refresh cookie seteada/actualizada

7) **Login inválido**
- Body: password incorrecto
- Esperado: 401 Unauthorized

---

### 4.4 Refresh token (CSRF protegido)
8) **POST /auth/refresh sin CSRF header**
- Acción: `POST {{baseUrl}}/auth/refresh` (sin `x-csrf-token`)
- Esperado: 403 Forbidden `CSRF token missing`

9) **POST /auth/refresh con CSRF OK**
- Headers: `x-csrf-token: {{csrfToken}}`
- Acción: `POST {{baseUrl}}/auth/refresh`
- Esperado:
  - 200 o 201 (documentar)
  - nuevo access token en body
  - refresh cookie rotada
  - `AuthSession` nueva o marcada como reemplazada (según diseño)

10) **Refresh reuse detection**
- Acción: usar un refresh token “viejo” (antes de rotación) y reintentar refresh
- Esperado: 401 Unauthorized (o 403 según tu estrategia) y sesión invalidada/revocada

---

### 4.5 Logout (CSRF protegido)
11) **POST /auth/logout sin CSRF**
- Esperado: 403 Forbidden

12) **POST /auth/logout con CSRF OK**
- Headers: `x-csrf-token: {{csrfToken}}`
- Esperado:
  - 200/204
  - refresh cookie inválida/limpiada o sesión revocada
  - refresh posterior falla (401/403)

---

### 4.6 JWT Guard (protección global)
13) **Endpoint protegido sin Authorization**
- Ej: `GET /users`
- Esperado: 401 Unauthorized

14) **Endpoint protegido con Authorization válido**
- Header: `Authorization: Bearer {{accessToken}}`
- Esperado: 200

15) **Token expirado**
- Acción: usar token vencido
- Esperado: 401

---

### 4.7 RBAC + PermissionsGuard
> Usar dos usuarios: uno ADMIN y otro USER (o remover role al user).

16) **ADMIN accede a listado**
- Endpoint: `GET /users`
- Permiso requerido: `users.read`
- Esperado: 200

17) **USER intenta listado**
- Endpoint: `GET /users`
- Esperado: 403 Forbidden (missing permission/role)

18) **ADMIN create**
- Endpoint: `POST /users`
- Permiso: `users.write`
- Esperado: 201/200 + usuario creado

19) **USER create**
- Endpoint: `POST /users`
- Esperado: 403

---

### 4.8 Scope (service-level)
20) **USER lee su propio perfil**
- Endpoint: `GET /users/me`
- Esperado: 200 + datos del usuario actual (idealmente desde DB y respetando isActive)

21) **USER intenta leer otro user por id**
- Endpoint: `GET /users/:id` (id de otro)
- Esperado: 403 Forbidden (Access denied)

22) **ADMIN lee cualquier user por id**
- Esperado: 200

23) **ADMIN desactiva usuario (soft delete)**
- Endpoint: `DELETE /users/:id`
- Esperado: 200 + `isActive=false`

24) **Usuario desactivado no puede operar**
- Acción: loguear o refrescar con usuario desactivado (según política)
- Esperado: 401/403 (definir política y documentarla)
- Nota: esto es una decisión de producto: algunos sistemas permiten login pero bloquean recursos; otros bloquean login.

---

### 4.9 Audit Logs
25) **Acciones mutativas generan audit log**
- Probar: POST /users, PATCH /users/:id, DELETE /users/:id, logout, refresh
- Esperado: fila nueva en `AuditLog` con:
  - actorUserId
  - method + path
  - statusCode
  - metadata opcional

26) **Errores también auditan**
- Provocar un 403/401/404 en endpoint mutativo y verificar audit con statusCode acorde.

---

## 5) Tests recomendados “Opción C” (si se agregan)
- Rate limiting:
  - N requests / minuto en `/auth/login` => 429 Too Many Requests
- Brute-force lockout:
  - X intentos fallidos => cuenta/IP bloqueada temporalmente
- Helmet headers:
  - verificar headers (CSP/referrer/etc.) en respuesta

---

## 6) SQL útil para verificación rápida

```sql
-- Últimos audit logs
SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50;

-- Sesiones activas
SELECT * FROM "AuthSession" WHERE "revokedAt" IS NULL ORDER BY "createdAt" DESC;

-- Roles de un usuario
SELECT ur."userId", r."name"
FROM "UserRole" ur
JOIN "Role" r ON r."id" = ur."roleId"
WHERE ur."userId" = '<USER_ID>';

-- Permisos efectivos de un usuario
SELECT DISTINCT p."key"
FROM "UserRole" ur
JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
JOIN "Permission" p ON p."id" = rp."permissionId"
WHERE ur."userId" = '<USER_ID>';
```

---

## 7) Notas finales para “cero mantenimiento”
Para cumplir tu objetivo (“no tocar nada salvo negocio nuevo”):
- Mantener el core de auth/guards/interceptors estable.
- Agregar permisos nuevos solo por seed/migración + decorators en endpoints nuevos.
- Scope: centralizar en helpers (como hicimos con users) y reutilizar patrón para recursos nuevos.

