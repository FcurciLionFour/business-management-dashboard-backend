# How to Add Controllers (Scaling Without Breaking Security)

**Date:** 2026-01-28  
This document provides strict rules and templates for adding new controllers/modules while preserving the boilerplate's security model.

---

## 1. Core rule: classify endpoints first

Every endpoint must be classified as one of:

### Type A — Admin / global capability
Examples:
- `GET /users` (list all users)
- `GET /audit` (list logs)
- `POST /roles` (manage roles)

**Enforcement:** RBAC (PermissionsGuard + permissions decorator)

### Type B — Ownership / self
Examples:
- `GET /users/:id` (self-only, admin bypass)
- `GET /projects/:id` (owner-only, admin bypass)

**Enforcement:** Scope helper in service

### Type C — Mixed (role + scope)
Examples:
- Support can read any record but only within organization
- Manager can act on team resources

**Enforcement:** permission + scope helper (org/tenant/owner checks)

---

## 2. Module template

Create module folder:
```
src/modules/<entity>/
  dto/
  <entity>.controller.ts
  <entity>.service.ts
  <entity>.module.ts
```

---

## 3. Controller templates

### 3.1 Admin-only endpoints (RBAC)

```ts
@Controller('entities')
@UseGuards(JwtGlobalGuard, PermissionsGuard)
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}  

  @RequirePermissions('entities.read')
  @Get()
  listAll() {
    return this.entitiesService.listAll();
  }

  @RequirePermissions('entities.write')
  @Post()
  create(@Body() dto: CreateEntityDto) {
    return this.entitiesService.create(dto);
  }
}
```

### 3.2 Ownership endpoint

```ts
@Controller('entities')
@UseGuards(JwtGlobalGuard)
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}  

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.entitiesService.getById(id, user.sub);
  }
}
```

Important:
- Do not add `@RequirePermissions('entities.read')` here unless your product explicitly requires it.
- Scope helper controls self vs admin.

---

## 4. Service template for ownership + admin bypass

```ts
@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}  

  async getById(id: string, requesterUserId: string) {
    await this.assertCanAccessEntity(id, requesterUserId);
    return this.prisma.entity.findUnique({
      where: { id },
      select: { /* explicit select */ },
    });
  }

  private async assertCanAccessEntity(id: string, requesterUserId: string) {
    if (await this.isAdmin(requesterUserId)) return;

    const entity = await this.prisma.entity.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!entity) throw new NotFoundException('Entity not found');
    if (entity.ownerId !== requesterUserId) throw new ForbiddenException('Access denied');
  }

  private async isAdmin(userId: string) {
    return !!(await this.prisma.userRole.findFirst({
      where: { userId, role: { name: 'ADMIN' } },
      select: { userId: true },
    }));
  }
}
```

Rules:
- Admin bypass first
- One helper per entity
- No duplicated checks outside helper

---

## 5. Adding permissions (strict workflow)

1. Choose permission keys: `<entity>.<verb>`
   - `projects.read`, `projects.write`
2. Add them to seed (`Permission` table).
3. Map to roles in seed (`RolePermission`).
4. Use `@RequirePermissions(...)` on admin endpoints only.
5. Keep self logic in scope helper.

---

## 6. Adding new roles safely

When adding a new role (e.g., SUPPORT):
- Decide which permissions it should have globally (seed)
- Update scope helpers if needed (e.g., org-based access)
- Avoid changing controllers unless absolutely required

---

## 7. Quality checklist per new module

- [ ] Endpoints classified (Admin / Ownership / Mixed)
- [ ] RBAC applied only to admin endpoints
- [ ] Scope helper exists for ownership endpoints
- [ ] DTOs exist for create/update
- [ ] Explicit Prisma selects/includes
- [ ] Audit logs for mutations (if required)
- [ ] E2E tests updated
