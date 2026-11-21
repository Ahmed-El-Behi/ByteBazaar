import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Nécessite la base de données de développement (DATABASE_URL dans backend/.env)
describe('ByteBazaar API (e2e)', () => {
  let app: INestApplication<App>;

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

  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it('GET /products returns a page sorted by relevance by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?limit=12')
      .expect(200);
    expect(res.body.data).toHaveLength(12);
    expect(
      new Set(
        res.body.data.map(
          (p: { category: { slug: string } }) => p.category.slug,
        ),
      ).size,
    ).toBeGreaterThan(1);
  });

  it('GET /admin/orders requires authentication', () => {
    return request(app.getHttpServer()).get('/admin/orders').expect(401);
  });
});
