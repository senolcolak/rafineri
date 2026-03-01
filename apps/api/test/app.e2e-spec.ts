import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) - should return health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('status');
        expect(res.body.data.services).toHaveProperty('database');
        expect(res.body.data.services).toHaveProperty('redis');
      });
  });

  it('/v1/categories (GET) - should return categories', () => {
    return request(app.getHttpServer())
      .get('/v1/categories')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('/v1/trending (GET) - should return trending stories', () => {
    return request(app.getHttpServer())
      .get('/v1/trending')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('stories');
        expect(res.body.data).toHaveProperty('meta');
        expect(Array.isArray(res.body.data.stories)).toBe(true);
      });
  });
});
