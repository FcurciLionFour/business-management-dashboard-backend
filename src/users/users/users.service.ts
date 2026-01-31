import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 📖 LISTAR USUARIOS (ADMIN)
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: u.roles.map((ur) => ur.role.name),
    }));
  }

  // 🔍 OBTENER USUARIO
  async findById(
    id: string,
    requesterId: string,
  ): Promise<UserResponseDto | null> {
    await this.assertCanAccessUser(id, requesterId);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  // ➕ CREAR USUARIO (ADMIN)
  async create(data: { email: string; password: string; roles: string[] }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (exists) {
      throw new ForbiddenException('User already exists');
    }

    if (!data.roles || data.roles.length === 0) {
      throw new ForbiddenException('At least one role is required');
    }

    // 1️⃣ Buscar roles válidos
    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: data.roles,
        },
      },
    });

    if (roles.length !== data.roles.length) {
      throw new ForbiddenException('One or more roles are invalid');
    }

    // 2️⃣ Crear usuario + asignar roles
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password, // 🔐 hash en AuthService
        isActive: true,
        roles: {
          create: roles.map((role) => ({
            role: {
              connect: { id: role.id },
            },
          })),
        },
      },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  // ✏️ ACTUALIZAR USUARIO
  async update(
    id: string,
    data: Partial<{
      email: string;
      isActive: boolean;
      roles: string[];
    }>,
    requesterId: string,
  ) {
    await this.assertCanAccessUser(id, requesterId);

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1️⃣ Separar roles del resto del payload
    const { roles, ...userData } = data;

    // 2️⃣ Actualizar campos simples si existen
    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id },
        data: userData,
      });
    }

    // 3️⃣ Si vienen roles → reemplazarlos
    if (roles) {
      if (roles.length === 0) {
        throw new ForbiddenException('User must have at least one role');
      }

      const dbRoles = await this.prisma.role.findMany({
        where: {
          name: { in: roles },
        },
      });

      if (dbRoles.length !== roles.length) {
        throw new ForbiddenException('One or more roles are invalid');
      }

      // limpiar relaciones actuales
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // crear nuevas relaciones
      await this.prisma.userRole.createMany({
        data: dbRoles.map((role) => ({
          userId: id,
          roleId: role.id,
        })),
      });
    }

    // 4️⃣ Devolver estado final consistente
    const updated = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return {
      id: updated!.id,
      email: updated!.email,
      isActive: updated!.isActive,
      roles: updated!.roles.map((ur) => ur.role.name),
    };
  }

  // 🗑️ BORRAR USUARIO (soft delete)
  async remove(id: string, requesterId: string) {
    await this.assertCanAccessUser(id, requesterId);
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return { success: true };
  }
  private async assertCanAccessUser(
    targetUserId: string,
    requesterUserId: string,
  ): Promise<void> {
    // 1️⃣ Si es ADMIN → acceso total
    const isAdmin = await this.prisma.userRole.findFirst({
      where: {
        userId: requesterUserId,
        role: {
          name: 'ADMIN',
        },
      },
    });

    if (isAdmin) {
      return;
    }

    // 2️⃣ Si no es admin, solo puede acceder a sí mismo
    if (targetUserId === requesterUserId) {
      return;
    }

    // 3️⃣ Caso contrario → forbidden
    throw new ForbiddenException('Access denied');
  }
}
