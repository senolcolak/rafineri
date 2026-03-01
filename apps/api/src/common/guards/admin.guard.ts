import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const adminToken = request.headers['x-admin-token'];
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
