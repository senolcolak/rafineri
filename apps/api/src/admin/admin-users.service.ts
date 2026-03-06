import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { adminUsers, adminSessions, auditLogs } from '@/database/schema';
import { hashPassword } from './admin-auth.utils';

type Role = 'admin' | 'editor' | 'reviewer' | 'viewer';

@Injectable()
export class AdminUsersService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: Database) {}

  async listUsers() {
    const users = await this.db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        email: adminUsers.email,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
        lastLoginAt: adminUsers.lastLoginAt,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(desc(adminUsers.createdAt));

    return users.map((user) => ({
      id: String(user.id),
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive === 1,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async createUser(input: {
    username: string;
    email: string;
    password: string;
    role: Role;
    createdBy?: number;
  }) {
    try {
      const now = new Date();
      const [created] = await this.db
        .insert(adminUsers)
        .values({
          username: input.username.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash: hashPassword(input.password),
          role: input.role,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: adminUsers.id,
          username: adminUsers.username,
          email: adminUsers.email,
          role: adminUsers.role,
          isActive: adminUsers.isActive,
          createdAt: adminUsers.createdAt,
        });

      await this.db.insert(auditLogs).values({
        adminUserId: input.createdBy,
        action: 'admin_user.created',
        entityType: 'admin_user',
        entityId: String(created.id),
        metadata: {
          username: created.username,
          role: created.role,
        },
      });

      return {
        id: String(created.id),
        username: created.username,
        email: created.email,
        role: created.role,
        isActive: created.isActive === 1,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async updateUser(
    id: number,
    input: {
      email?: string;
      password?: string;
      role?: Role;
      isActive?: boolean;
      updatedBy?: number;
    },
  ) {
    const [existing] = await this.db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    if (!existing) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    const updateData: Partial<typeof adminUsers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.email !== undefined) updateData.email = input.email.trim().toLowerCase();
    if (input.role !== undefined) updateData.role = input.role;
    if (input.isActive !== undefined) updateData.isActive = input.isActive ? 1 : 0;
    if (input.password !== undefined) updateData.passwordHash = hashPassword(input.password);

    await this.db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id));

    if (input.isActive === false) {
      await this.db
        .update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(adminSessions.adminUserId, id), isNull(adminSessions.revokedAt)));
    }

    await this.db.insert(auditLogs).values({
      adminUserId: input.updatedBy,
      action: 'admin_user.updated',
      entityType: 'admin_user',
      entityId: String(id),
      metadata: input,
    });

    return {
      id: String(id),
      message: 'User updated successfully',
    };
  }

  async deleteUser(id: number, deletedBy?: number) {
    const [existing] = await this.db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    if (!existing) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    await this.db.delete(adminSessions).where(eq(adminSessions.adminUserId, id));
    await this.db.delete(adminUsers).where(eq(adminUsers.id, id));
    await this.db.insert(auditLogs).values({
      adminUserId: deletedBy,
      action: 'admin_user.deleted',
      entityType: 'admin_user',
      entityId: String(id),
      metadata: {},
    });

    return {
      id: String(id),
      message: 'User deleted successfully',
    };
  }
}
