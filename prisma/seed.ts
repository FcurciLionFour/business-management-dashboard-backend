import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Regular user',
    },
  });

  // 2) Permissions
  const usersRead = await prisma.permission.upsert({
    where: { key: 'users.read' },
    update: {},
    create: {
      key: 'users.read',
      description: 'Read users',
    },
  });

  const usersWrite = await prisma.permission.upsert({
    where: { key: 'users.write' },
    update: {},
    create: {
      key: 'users.write',
      description: 'Write users',
    },
  });

  // 3) Role ↔ Permission
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: usersRead.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: usersRead.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: usersWrite.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: usersWrite.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: userRole.id,
        permissionId: usersRead.id,
      },
    },
    update: {},
    create: {
      roleId: userRole.id,
      permissionId: usersRead.id,
    },
  });

  // 4) Asignar ADMIN a usuario test
  const TEST_EMAIL = 'test@test.com'; // ⬅️ AJUSTÁ SI HACE FALTA

  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (!user) {
    console.warn(`
        ⚠️ Usuario ${TEST_EMAIL} no existe. Saltando asignación de rol.`);
    return;
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Seed RBAC completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
