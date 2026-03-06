import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { AdminUsersService } from './admin-users.service';

type Role = 'admin' | 'editor' | 'reviewer' | 'viewer';

@ApiTags('Admin - Users')
@ApiSecurity('admin-token')
@Controller('admin/users')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List admin users' })
  async listUsers() {
    return this.usersService.listUsers();
  }

  @Post()
  @ApiOperation({ summary: 'Create admin user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'email', 'password', 'role'],
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'editor', 'reviewer', 'viewer'] },
      },
    },
  })
  async createUser(
    @Req() req: Request & { adminUserId?: number; adminRole?: string },
    @Body()
    body: {
      username: string;
      email: string;
      password: string;
      role: Role;
    },
  ) {
    this.ensureAdmin(req);
    return this.usersService.createUser({
      ...body,
      createdBy: req.adminUserId,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'editor', 'reviewer', 'viewer'] },
        isActive: { type: 'boolean' },
      },
    },
  })
  async updateUser(
    @Req() req: Request & { adminUserId?: number; adminRole?: string },
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      email?: string;
      password?: string;
      role?: Role;
      isActive?: boolean;
    },
  ) {
    this.ensureAdmin(req);
    return this.usersService.updateUser(id, {
      ...body,
      updatedBy: req.adminUserId,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete admin user' })
  async deleteUser(
    @Req() req: Request & { adminUserId?: number; adminRole?: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureAdmin(req);
    return this.usersService.deleteUser(id, req.adminUserId);
  }

  private ensureAdmin(req: Request & { adminRole?: string }) {
    if (req.adminRole && req.adminRole !== 'admin') {
      throw new UnauthorizedException('Admin role required');
    }
  }
}
