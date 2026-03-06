/**
 * Admin Auth Controller
 * 
 * Handles admin authentication without requiring prior auth.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
  Res,
  Req,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { adminUsers, adminSessions } from '@/database/schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import {
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './admin-auth.utils';
import { Logger } from 'nestjs-pino';

class LoginDto {
  username!: string;
  password!: string;
}

@ApiTags('Admin - Auth')
@Controller('admin/auth')
@UseInterceptors(TransformInterceptor)
export class AdminAuthController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiSecurity('admin-token')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const user = await this.findOrBootstrapUser(dto.username);
    if (!user || user.isActive !== 1 || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresIn = 60 * 60 * 24; // 24h
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    await this.db.insert(adminSessions).values({
      adminUserId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: this.readIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 512),
    });

    await this.db
      .update(adminUsers)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(adminUsers.id, user.id));

    const useSecure = process.env.COOKIE_SECURE === 'true';
    res.setHeader('Set-Cookie', [
      `admin_token=${token}; HttpOnly; ${useSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${expiresIn}`,
    ]);

    return {
      success: true,
      data: {
        token,
        expiresIn,
      },
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Admin logout' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readToken(req);
    if (token) {
      await this.db
        .update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(eq(adminSessions.tokenHash, hashToken(token)));
    }

    res.setHeader('Set-Cookie', [
      'admin_token=; Path=/; Max-Age=0',
    ]);
    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify admin token' })
  @ApiSecurity('admin-token')
  async verify(@Req() req: Request) {
    const token = this.readToken(req);
    if (!token) {
      return {
        success: true,
        data: { valid: false },
      };
    }

    const now = new Date();
    const [session] = await this.db
      .select({ id: adminSessions.id })
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.tokenHash, hashToken(token)),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now),
        ),
      )
      .limit(1);

    let valid = !!session;
    if (!valid) {
      const expectedToken = this.configService.get<string>('security.adminToken');
      valid = token === expectedToken;
    }

    return {
      success: true,
      data: {
        valid,
      },
    };
  }

  private async findOrBootstrapUser(username: string): Promise<{
    id: number;
    username: string;
    passwordHash: string;
    isActive: number;
  } | null> {
    const [user] = await this.db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        passwordHash: adminUsers.passwordHash,
        isActive: adminUsers.isActive,
      })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (user) {
      return user;
    }

    const envAdminUsername = this.configService.get<string>('RAFINERI_ADMIN');
    const envAdminPassword = this.configService.get<string>('RAFINERI_ADMIN_PASSWORD');
    if (!envAdminUsername || !envAdminPassword || envAdminUsername !== username) {
      return null;
    }

    try {
      const [created] = await this.db
        .insert(adminUsers)
        .values({
          username: envAdminUsername,
          email: `${envAdminUsername}@local.rafineri`,
          passwordHash: hashPassword(envAdminPassword),
          role: 'admin',
          isActive: 1,
        })
        .returning({
          id: adminUsers.id,
          username: adminUsers.username,
          passwordHash: adminUsers.passwordHash,
          isActive: adminUsers.isActive,
        });
      return created;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to bootstrap admin user');
      throw new InternalServerErrorException('Failed to initialize admin user');
    }
  }

  private readToken(req: Request): string | null {
    const headerToken = req.headers['x-admin-token'];
    if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
      return headerToken;
    }

    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }

    const cookie = req.headers.cookie;
    if (!cookie) {
      return null;
    }
    const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private readIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() || null;
    }
    return req.ip || null;
  }
}
