import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Logger } from 'nestjs-pino';
import { AdminAuthController } from '../../src/admin/admin-auth.controller';
import { hashPassword } from '../../src/admin/admin-auth.utils';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';

describe('Admin Auth (e2e)', () => {
  let app: INestApplication;

  const dbMock = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };

  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === 'security.adminToken') return 'test-admin-token';
      if (key === 'RAFINERI_ADMIN') return 'bootstrap-admin';
      if (key === 'RAFINERI_ADMIN_PASSWORD') return 'BootstrapPass123!';
      return undefined;
    }),
  };

  const loggerMock = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        { provide: ConfigService, useValue: configServiceMock },
        { provide: DRIZZLE_PROVIDER, useValue: dbMock },
        { provide: Logger, useValue: loggerMock },
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
    dbMock.returning.mockReset().mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/admin/auth/login authenticates valid credentials and sets cookie', async () => {
    dbMock.limit.mockResolvedValueOnce([
      {
        id: 1,
        username: 'admin',
        passwordHash: hashPassword('Password123!'),
        isActive: 1,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: 'admin', password: 'Password123!' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.expiresIn).toBe(60 * 60 * 24);
    expect(typeof response.body.data.token).toBe('string');
    expect(response.headers['set-cookie'][0]).toContain('admin_token=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });

  it('POST /v1/admin/auth/login rejects invalid credentials', async () => {
    dbMock.limit.mockResolvedValueOnce([
      {
        id: 1,
        username: 'admin',
        passwordHash: hashPassword('WrongPassword123!'),
        isActive: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: 'admin', password: 'Password123!' })
      .expect(401);
  });

  it('POST /v1/admin/auth/login bootstraps env admin user when user is missing', async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    dbMock.returning.mockResolvedValueOnce([
      {
        id: 2,
        username: 'bootstrap-admin',
        passwordHash: hashPassword('BootstrapPass123!'),
        isActive: 1,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: 'bootstrap-admin', password: 'BootstrapPass123!' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(dbMock.returning).toHaveBeenCalledTimes(1);
  });

  it('GET /v1/admin/auth/verify returns false when token is missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/auth/verify')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { valid: false },
    });
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('GET /v1/admin/auth/verify returns true for active session token', async () => {
    dbMock.limit.mockResolvedValueOnce([{ id: 99 }]);

    const response = await request(app.getHttpServer())
      .get('/v1/admin/auth/verify')
      .set('x-admin-token', 'session-token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { valid: true },
    });
  });

  it('GET /v1/admin/auth/verify falls back to configured static token', async () => {
    dbMock.limit.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .get('/v1/admin/auth/verify')
      .set('x-admin-token', 'test-admin-token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { valid: true },
    });
  });

  it('POST /v1/admin/auth/logout revokes token and clears cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/admin/auth/logout')
      .set('x-admin-token', 'session-token')
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toBe('Logged out successfully');
    expect(response.headers['set-cookie'][0]).toContain('admin_token=');
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(dbMock.update).toHaveBeenCalled();
  });
});
