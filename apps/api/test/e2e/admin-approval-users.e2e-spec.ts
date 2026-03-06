import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AdminApprovalController } from '../../src/admin/admin-approval.controller';
import { AdminUsersController } from '../../src/admin/admin-users.controller';
import { AdminApprovalService } from '../../src/admin/admin-approval.service';
import { AdminUsersService } from '../../src/admin/admin-users.service';
import { CrossCheckService } from '../../src/cross-check/cross-check.service';
import { HttpValidator } from '../../src/cross-check/http.validator';
import { AdminGuard } from '../../src/common/guards/admin.guard';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';

describe('Admin Approval + Users (e2e)', () => {
  let app: INestApplication;

  const dbMock = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  };

  const approvalServiceMock = {
    submitRequest: jest.fn().mockResolvedValue({
      requestId: '101',
      status: 'queued',
      message: 'Story submitted for approval',
    }),
    listRequests: jest.fn().mockResolvedValue({
      items: [
        {
          id: '101',
          storyId: '1',
          status: 'queued',
          priority: 0,
          finalConfidence: null,
          finalReason: null,
          createdAt: '2026-03-06T10:00:00.000Z',
          updatedAt: '2026-03-06T10:00:00.000Z',
          completedAt: null,
        },
      ],
      page: 1,
      limit: 20,
    }),
    getRequest: jest.fn().mockResolvedValue({
      id: '101',
      storyId: '1',
      status: 'queued',
      finalConfidence: null,
      finalReason: null,
      steps: [],
      decisions: [],
    }),
    retryRequest: jest.fn().mockResolvedValue({
      id: '101',
      status: 'queued',
      message: 'Approval request queued for retry',
    }),
    cancelRequest: jest.fn().mockResolvedValue({
      id: '101',
      status: 'cancelled',
      message: 'Approval request cancelled',
    }),
    manualDecision: jest.fn().mockResolvedValue({
      id: '101',
      status: 'approved',
      message: 'Request approved by manual review',
    }),
  };

  const usersServiceMock = {
    listUsers: jest.fn().mockResolvedValue([
      {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        lastLoginAt: null,
        createdAt: '2026-03-06T10:00:00.000Z',
      },
    ]),
    createUser: jest.fn().mockResolvedValue({
      id: '2',
      username: 'editor',
      email: 'editor@example.com',
      role: 'editor',
      isActive: true,
      createdAt: '2026-03-06T10:00:00.000Z',
    }),
    updateUser: jest.fn().mockResolvedValue({
      id: '2',
      message: 'User updated successfully',
    }),
    deleteUser: jest.fn().mockResolvedValue({
      id: '2',
      message: 'User deleted successfully',
    }),
  };

  const crossCheckServiceMock = {
    crossCheck: jest.fn().mockResolvedValue({
      overallStatus: 'verified',
      confidence: 0.82,
      sourcesChecked: ['wikipedia'],
      results: [],
      consensus: 'Strong consensus for verification',
      discrepancies: [],
      recommendations: [],
    }),
    getValidatorConfigs: jest.fn().mockReturnValue([
      { name: 'wikipedia', enabled: true, weight: 0.3, timeoutMs: 10000, priority: 1 },
    ]),
  };

  const httpValidatorMock = {
    testRule: jest.fn().mockResolvedValue({
      name: 'test',
      passed: true,
      responseTime: 10,
      extractedValue: 'ok',
      matched: true,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminApprovalController, AdminUsersController],
      providers: [
        { provide: AdminApprovalService, useValue: approvalServiceMock },
        { provide: AdminUsersService, useValue: usersServiceMock },
        { provide: CrossCheckService, useValue: crossCheckServiceMock },
        { provide: HttpValidator, useValue: httpValidatorMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'security.adminToken') return 'test-admin-token';
              return undefined;
            }),
          },
        },
        { provide: DRIZZLE_PROVIDER, useValue: dbMock },
        AdminGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
      prefix: 'v',
    });
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbMock.limit.mockReset().mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/admin/approval/requests queues approval request', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/admin/approval/requests')
      .set('x-admin-token', 'test-admin-token')
      .send({
        storyId: '1',
        claim: 'Claim text',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      requestId: '101',
      status: 'queued',
    });
    expect(approvalServiceMock.submitRequest).toHaveBeenCalled();
  });

  it('POST /v1/admin/approval/requests/:id/manual-decision applies manual review', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/admin/approval/requests/101/manual-decision')
      .set('x-admin-token', 'test-admin-token')
      .send({
        decision: 'approved',
        reason: 'Validated by editor',
        confidence: 0.9,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('approved');
    expect(approvalServiceMock.manualDecision).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        decision: 'approved',
        reason: 'Validated by editor',
        confidence: 0.9,
        decidedBy: undefined,
      }),
    );
  });

  it('GET /v1/admin/approval/validators returns configured validators', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/approval/validators')
      .set('x-admin-token', 'test-admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      name: 'wikipedia',
      enabled: true,
      weight: 0.3,
    });
  });

  it('GET /v1/admin/users returns users', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('x-admin-token', 'test-admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0].username).toBe('admin');
  });

  it('POST /v1/admin/users creates user', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/admin/users')
      .set('x-admin-token', 'test-admin-token')
      .send({
        username: 'editor',
        email: 'editor@example.com',
        password: 'Password123!',
        role: 'editor',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.username).toBe('editor');
    expect(usersServiceMock.createUser).toHaveBeenCalled();
  });

  it('rejects missing admin token', async () => {
    await request(app.getHttpServer()).get('/v1/admin/users').expect(401);
    expect(usersServiceMock.listUsers).not.toHaveBeenCalled();
  });

  it('rejects invalid admin token', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('x-admin-token', 'wrong-token')
      .expect(401);

    expect(usersServiceMock.listUsers).not.toHaveBeenCalled();
  });

  it('accepts bearer token authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('authorization', 'Bearer test-admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(usersServiceMock.listUsers).toHaveBeenCalledTimes(1);
  });

  it('accepts cookie token authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('cookie', 'admin_token=test-admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(usersServiceMock.listUsers).toHaveBeenCalledTimes(1);
  });

  it('blocks non-admin role from creating users', async () => {
    dbMock.limit.mockResolvedValueOnce([
      {
        sessionId: 11,
        userId: 91,
        role: 'viewer',
        isActive: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/v1/admin/users')
      .set('x-admin-token', 'session-token')
      .send({
        username: 'blocked-user',
        email: 'blocked@example.com',
        password: 'Password123!',
        role: 'viewer',
      })
      .expect(401);

    expect(usersServiceMock.createUser).not.toHaveBeenCalled();
  });

  it('passes admin user id from valid session to user creation', async () => {
    dbMock.limit.mockResolvedValueOnce([
      {
        sessionId: 12,
        userId: 77,
        role: 'admin',
        isActive: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/v1/admin/users')
      .set('x-admin-token', 'session-token')
      .send({
        username: 'editor2',
        email: 'editor2@example.com',
        password: 'Password123!',
        role: 'editor',
      })
      .expect(201);

    expect(usersServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'editor2',
        email: 'editor2@example.com',
        role: 'editor',
        createdBy: 77,
      }),
    );
  });

  it('passes session user id into manual decision metadata', async () => {
    dbMock.limit.mockResolvedValueOnce([
      {
        sessionId: 13,
        userId: 55,
        role: 'reviewer',
        isActive: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/v1/admin/approval/requests/101/manual-decision')
      .set('x-admin-token', 'session-token')
      .send({
        decision: 'rejected',
        reason: 'Insufficient evidence',
        confidence: 0.4,
      })
      .expect(201);

    expect(approvalServiceMock.manualDecision).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        decision: 'rejected',
        reason: 'Insufficient evidence',
        confidence: 0.4,
        decidedBy: 55,
      }),
    );
  });
});
