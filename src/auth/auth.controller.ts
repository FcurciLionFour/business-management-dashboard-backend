import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';

import type { Request, Response } from 'express'; // 👈 CLAVE
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { randomUUID } from 'crypto';
import { CsrfGuard } from './guards/csrf.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto.email, dto.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return { accessToken: tokens.accessToken };
  }

  @Get('me')
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.getSession(user.sub);
  }

  @UseGuards(CsrfGuard)
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    const tokens = await this.authService.refresh(refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return { accessToken: tokens.accessToken };
  }

  @UseGuards(CsrfGuard)
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    res.clearCookie('refresh_token');

    return this.authService.logout(refreshToken);
  }

  @Public()
  @Get('csrf')
  getCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = randomUUID();

    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // clave para double submit
      sameSite: 'lax', // luego puede ser 'none'
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return { ok: true };
  }
  // 1️⃣ Forgot password (public)
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  // 2️⃣ Reset password (public, token-based)
  @Public()
  @Post('reset-password')
  resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  // 3️⃣ Change password (authenticated)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: { sub: string },
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.changePassword(
      user.sub,
      currentPassword,
      newPassword,
    );
  }
}
