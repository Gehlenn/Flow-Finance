import request from 'supertest';
import app from '../../src/index';

describe('Auth API', () => {
  it('POST /api/auth/login deve responder 200', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@flow.com', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /api/auth/refresh deve responder 200', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'refresh@flow.com', password: '123456' });

    expect(login.status).toBe(200);
    expect(login.body.refreshToken).toBeDefined();

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });
});
