import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API MVP-1', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /health → 200', () => request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  it('GET /zonas → 200 solo con zonas publicadas', async () => {
    const res = await request(app.getHttpServer()).get('/zonas').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: expect.any(String), nombre: expect.any(String), ciudad: 'Puebla' }));
    expect(res.body.map((z: any) => z.nombre)).not.toContain('Colonia en revisión (demo)');
  });

  it('GET /zonas?ciudad=Inexistente → []', () =>
    request(app.getHttpServer()).get('/zonas').query({ ciudad: 'Inexistente' }).expect(200, []));
});
