import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtGlobalGuard } from 'src/auth/guards/jwt-global.guard';

@Controller('users')
@UseGuards(JwtGlobalGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // 📖 LISTAR USUARIOS
  @RequirePermissions('users.read')
  @Get()
  @UseGuards(PermissionsGuard)
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  // 👤 PERFIL PROPIO
  @Get('me')
  me(@CurrentUser() user: { sub: string }) {
    return user;
  }

  // 🔍 OBTENER USUARIO
  @Get(':id')
  @UseGuards(PermissionsGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ): Promise<UserResponseDto | null> {
    return this.usersService.findById(id, user.sub);
  }

  // ➕ CREAR USUARIO
  @RequirePermissions('users.write')
  @Post()
  @UseGuards(PermissionsGuard)
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  // ✏️ ACTUALIZAR USUARIO
  @RequirePermissions('users.write')
  @Patch(':id')
  @UseGuards(PermissionsGuard)
  update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.update(id, body, user.sub);
  }

  // 🗑️ BORRAR / DESACTIVAR USUARIO
  @RequirePermissions('users.write')
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.usersService.remove(id, user.sub);
  }
}
