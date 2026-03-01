import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

function parseCookie(cookieString: string | undefined, name: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? match[1] : null;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check header first
    let adminToken = request.headers['x-admin-token'] as string;
    
    // Also check cookie manually
    if (!adminToken) {
      const cookieHeader = request.headers['cookie'] as string | undefined;
      adminToken = parseCookie(cookieHeader, 'admin_token') || undefined;
    }
    
    const expectedToken = this.configService.get<string>('security.adminToken');

    if (!adminToken) {
      throw new UnauthorizedException('Missing admin token');
    }

    if (adminToken !== expectedToken) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}
