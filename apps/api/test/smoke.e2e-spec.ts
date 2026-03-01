import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Smoke Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('GET /v1/trending', () => {
    it('should return trending stories', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/trending')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept sort parameter', async () => {
      const sorts = ['hot', 'most_verified', 'most_contested', 'newest'];
      
      for (const sort of sorts) {
        const response = await request(app.getHttpServer())
          .get(`/v1/trending?sort=${sort}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
      }
    });

    it('should accept label filter', async () => {
      const labels = ['verified', 'likely', 'contested', 'unverified'];
      
      for (const label of labels) {
        const response = await request(app.getHttpServer())
          .get(`/v1/trending?label=${label}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
      }
    });

    it('should accept search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/trending?q=technology')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /v1/categories', () => {
    it('should return categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /v1/stories/:id', () => {
    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/v1/stories/999999')
        .expect(404);
    });
  });

  describe('GET /v1/stories/:id/claims', () => {
    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/v1/stories/999999/claims')
        .expect(404);
    });
  });

  describe('GET /v1/stories/:id/evidence', () => {
    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/v1/stories/999999/evidence')
        .expect(404);
    });
  });

  describe('GET /v1/stories/:id/events', () => {
    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/v1/stories/999999/events')
        .expect(404);
    });
  });

  describe('POST /v1/admin/stories/:id/rescore', () => {
    it('should require admin token', async () => {
      await request(app.getHttpServer())
        .post('/v1/admin/stories/1/rescore')
        .expect(401);
    });

    it('should reject invalid admin token', async () => {
      await request(app.getHttpServer())
        .post('/v1/admin/stories/1/rescore')
        .set('x-admin-token', 'invalid-token')
        .expect(401);
    });
  });
});
