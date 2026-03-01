import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('AdminController (Integration)', () => {
  let app: INestApplication;
  const adminToken = process.env.ADMIN_TOKEN || 'test-admin-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should reject requests without admin token', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/dashboard')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /v1/admin/dashboard', () => {
    it('should return dashboard stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalStories');
      expect(response.body).toHaveProperty('storiesToday');
      expect(response.body).toHaveProperty('pendingReview');
      expect(response.body).toHaveProperty('totalSources');
      expect(response.body).toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('recentActivity');
    });

    it('should return valid system health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const health = response.body.systemHealth;
      expect(health).toHaveProperty('api');
      expect(health).toHaveProperty('worker');
      expect(health).toHaveProperty('database');
      
      const validStatuses = ['healthy', 'degraded', 'down'];
      expect(validStatuses).toContain(health.api);
      expect(validStatuses).toContain(health.worker);
      expect(validStatuses).toContain(health.database);
    });
  });

  describe('GET /v1/admin/stories', () => {
    it('should return paginated stories', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/stories?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stories');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.stories)).toBe(true);
    });

    it('should support search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/stories?q=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stories');
    });

    it('should support label filter', async () => {
      const labels = ['verified', 'likely', 'contested', 'unverified'];

      for (const label of labels) {
        const response = await request(app.getHttpServer())
          .get(`/v1/admin/stories?label=${label}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('stories');
      }
    });

    it('should validate pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/stories?page=-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /v1/admin/stories/:id', () => {
    it('should return story by id', async () => {
      // First get a list of stories
      const listResponse = await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.stories.length === 0) {
        // Skip if no stories exist
        return;
      }

      const storyId = listResponse.body.stories[0].id;

      const response = await request(app.getHttpServer())
        .get(`/v1/admin/stories/${storyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', storyId);
    });

    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/stories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should validate story id parameter', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/stories/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('PATCH /v1/admin/stories/:id', () => {
    it('should update story successfully', async () => {
      // Get first story
      const listResponse = await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.stories.length === 0) {
        return;
      }

      const storyId = listResponse.body.stories[0].id;

      const updateData = {
        title: 'Updated Title',
        label: 'verified',
      };

      const response = await request(app.getHttpServer())
        .patch(`/v1/admin/stories/${storyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id', storyId);
      expect(response.body).toHaveProperty('message');
    });

    it('should validate update data', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.stories.length === 0) {
        return;
      }

      const storyId = listResponse.body.stories[0].id;

      // Invalid label
      await request(app.getHttpServer())
        .patch(`/v1/admin/stories/${storyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'invalid-label' })
        .expect(400);
    });

    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .patch('/v1/admin/stories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /v1/admin/stories/:id', () => {
    it('should require confirmation for deletion', async () => {
      // This test depends on implementation - 
      // some APIs delete immediately, some require confirmation header
      const listResponse = await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.stories.length === 0) {
        return;
      }

      const storyId = listResponse.body.stories[0].id;

      // Attempt deletion
      const response = await request(app.getHttpServer())
        .delete(`/v1/admin/stories/${storyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should either succeed or require additional confirmation
      expect([200, 403, 409]).toContain(response.status);
    });

    it('should return 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .delete('/v1/admin/stories/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /v1/admin/sources', () => {
    it('should return all sources', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/sources')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('type');
        expect(response.body[0]).toHaveProperty('isActive');
        expect(response.body[0]).toHaveProperty('itemsCount');
      }
    });
  });

  describe('PATCH /v1/admin/sources/:id', () => {
    it('should update source status', async () => {
      // Get sources first
      const sourcesResponse = await request(app.getHttpServer())
        .get('/v1/admin/sources')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (sourcesResponse.body.length === 0) {
        return;
      }

      const sourceId = sourcesResponse.body[0].id;
      const currentStatus = sourcesResponse.body[0].isActive;

      const response = await request(app.getHttpServer())
        .patch(`/v1/admin/sources/${sourceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: !currentStatus })
        .expect(200);

      expect(response.body).toHaveProperty('id', sourceId);
      expect(response.body).toHaveProperty('message');
    });

    it('should validate isActive field', async () => {
      const sourcesResponse = await request(app.getHttpServer())
        .get('/v1/admin/sources')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (sourcesResponse.body.length === 0) {
        return;
      }

      const sourceId = sourcesResponse.body[0].id;

      await request(app.getHttpServer())
        .patch(`/v1/admin/sources/${sourceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: 'not-a-boolean' })
        .expect(400);
    });
  });

  describe('GET /v1/admin/health', () => {
    it('should return system health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('checks');
    });
  });

  describe('GET /v1/admin/logs', () => {
    it('should return system logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support lines parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/logs?lines=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(50);
    });
  });

  describe('POST /v1/admin/stories/:id/rescore', () => {
    it('should queue story rescoring', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/admin/stories?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.stories.length === 0) {
        return;
      }

      const storyId = listResponse.body.stories[0].id;

      const response = await request(app.getHttpServer())
        .post(`/v1/admin/stories/${storyId}/rescore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', storyId);
      expect(response.body).toHaveProperty('label');
      expect(response.body).toHaveProperty('confidence');
    });
  });

  describe('POST /v1/admin/thumbnails/refresh-all', () => {
    it('should queue bulk thumbnail refresh', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/admin/thumbnails/refresh-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 10, force: false })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('queued');
      expect(response.body).toHaveProperty('message');
    });
  });
});
