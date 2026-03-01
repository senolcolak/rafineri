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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Response } from 'express';
import * as crypto from 'crypto';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UseInterceptors } from '@nestjs/common';

class LoginDto {
  username!: string;
  password!: string;
}

@ApiTags('Admin - Auth')
@Controller('admin/auth')
@UseInterceptors(TransformInterceptor)
export class AdminAuthController {
  constructor(private readonly configService: ConfigService) {}

  private generateToken(username: string, password: string): string {
    return crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
  }

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiSecurity('admin-token')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const expectedUsername = this.configService.get<string>('security.adminUsername') || this.configService.get<string>('RAFINERI_ADMIN');
    const expectedPassword = this.configService.get<string>('security.adminPassword') || this.configService.get<string>('RAFINERI_ADMIN_PASSWORD');
    
    // Fallback to checking against the hashed admin token
    const adminUsername = this.configService.get<string>('RAFINERI_ADMIN') || '';
    const adminPassword = this.configService.get<string>('RAFINERI_ADMIN_PASSWORD') || '';
    
    // Check if provided credentials match
    const isValidUsername = dto.username === adminUsername;
    const isValidPassword = dto.password === adminPassword;
    
    if (!isValidUsername || !isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate token (same logic as security config)
    const token = this.generateToken(dto.username, dto.password);

    // Set cookie manually (without cookie-parser)
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `admin_token=${token}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=86400`,
    ]);

    return {
      success: true,
      data: {
        token,
        expiresIn: 86400,
      },
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Admin logout' })
  async logout(@Res({ passthrough: true }) res: Response) {
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
  async verify(@Body() body: { token?: string }) {
    const expectedToken = this.configService.get<string>('security.adminToken');
    
    return {
      success: true,
      data: {
        valid: body.token === expectedToken,
      },
    };
  }
}
