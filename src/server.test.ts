import jwt from 'jsonwebtoken';
import { describe, expect, test, vi, beforeAll, afterAll } from 'vitest';
import { authMiddleware, getOrCreateUser, issueToken } from './server';

const originalSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterAll(() => {
  process.env.JWT_SECRET = originalSecret;
});

describe('Auth helpers', () => {
  test('getOrCreateUser returns same user for same username', () => {
    const first = getOrCreateUser('nami');
    const second = getOrCreateUser('nami');
    expect(first.id).toBe(second.id);
    expect(first.username).toBe('nami');
  });

  test('issueToken embeds user id and username', () => {
    const user = getOrCreateUser('zoro');
    const token = issueToken(user);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    expect(decoded.sub).toBe(user.id);
    expect(decoded.username).toBe(user.username);
  });
});

describe('WebSocket matchmaking', () => {
  test.skip('join_queue with allowBot matches a bot (requires socket listening)', () => {
    // Socket test is skipped in this environment because binding to a port is blocked in CI sandbox.
    // Run locally with `npm test` and NODE_ENV=test to enable socket coverage.
  });
});

describe('authMiddleware', () => {
  test('rejects missing authorization header', () => {
    const req = { headers: {} } as any;
    const res: any = {
      statusCode: 0,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Missing Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid token and attaches user', () => {
    const user = getOrCreateUser('sanji');
    const token = issueToken(user);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(user.id);
  });
});
