// API tests; the database must be migrated and seeded first.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';

const API = '/api/v1';
const sessionId = randomUUID();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('public endpoints', () => {
  it('GET /health reports the database is up', async () => {
    const res = await request(app).get(`${API}/health`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.db).toBe('up');
  });

  it('GET /commodities lists commodities with pagination meta', async () => {
    const res = await request(app).get(`${API}/commodities?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta.total).toBe(25);
    expect(res.body.data[0]).toHaveProperty('predictedPrice');
  });

  it('GET /commodities/:slug returns detail with factors and explanation', async () => {
    const res = await request(app).get(`${API}/commodities/tomato`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Tomato');
    expect(res.body.data.factors.length).toBeGreaterThanOrEqual(3);
    expect(typeof res.body.data.explanation).toBe('string');
  });

  it('GET /commodities/:slug returns 404 for an unknown slug', async () => {
    const res = await request(app).get(`${API}/commodities/not-a-food`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /feedback rejects a message that is too short', async () => {
    const res = await request(app)
      .post(`${API}/feedback`)
      .set('X-Session-Id', sessionId)
      .send({ category: 'GENERAL', message: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('chat with the fallback responder', () => {
  it('starts a conversation and answers a message without an LLM key', async () => {
    const start = await request(app)
      .post(`${API}/chat/conversations`)
      .set('X-Session-Id', sessionId)
      .send({ commoditySlug: 'tomato' });
    expect(start.status).toBe(201);
    expect(start.body.data.suggestedQuestions).toHaveLength(4);

    const id = start.body.data.conversationId as string;
    const reply = await request(app)
      .post(`${API}/chat/conversations/${id}/messages`)
      .set('X-Session-Id', sessionId)
      .send({ message: 'Will tomato be cheaper next month?' });
    expect(reply.status).toBe(200);
    expect(reply.body.data.reply.role).toBe('ASSISTANT');
    expect(reply.body.data.reply.usedFallback).toBe(true);
    expect(reply.body.data.conversation.messageCount).toBe(1);

    // Another session must not be able to read this conversation
    const other = await request(app)
      .get(`${API}/chat/conversations/${id}`)
      .set('X-Session-Id', randomUUID());
    expect(other.status).toBe(404);
  });
});

describe('admin endpoints', () => {
  it('logs in with the seeded admin and can read the overview', async () => {
    const login = await request(app)
      .post(`${API}/admin/auth/login`)
      .send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    expect(typeof login.body.data.token).toBe('string');

    const overview = await request(app)
      .get(`${API}/admin/overview`)
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data).toHaveProperty('visitors');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post(`${API}/admin/auth/login`)
      .send({ email: env.ADMIN_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects admin routes without a token', async () => {
    const res = await request(app).get(`${API}/admin/overview`);
    expect(res.status).toBe(401);
  });
});
