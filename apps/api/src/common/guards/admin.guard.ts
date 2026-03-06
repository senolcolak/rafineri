import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { adminSessions, adminUsers } from '@/database/schema';
import { hashToken } from '@/admin/admin-auth.utils';

function parseCookie(cookieString: string | undefined, name: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? match[1] : null;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    const adminToken = this.readToken(request);

    if (!adminToken) {
      throw new UnauthorizedException('Missing admin token');
    }

    const now = new Date();
    const [session] = await this.db
      .select({
        sessionId: adminSessions.id,
        userId: adminUsers.id,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
      .where(
        and(
          eq(adminSessions.tokenHash, hashToken(adminToken)),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (session && session.isActive === 1) {
      (request as Request & { adminUserId?: number; adminRole?: string }).adminUserId = session.userId;
      (request as Request & { adminUserId?: number; adminRole?: string }).adminRole = session.role;
      return true;
    }

    const expectedToken = this.configService.get<string>('security.adminToken');
    if (adminToken !== expectedToken) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }

  private readToken(request: Request): string | undefined {
    const headerToken = request.headers['x-admin-token'];
    if (typeof headerToken === 'string' && headerToken.length > 0) {
      return headerToken;
    }

    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }

    const cookieHeader = request.headers['cookie'] as string | undefined;
    return parseCookie(cookieHeader, 'admin_token') || undefined;
  }
}
