// Records the anonymous visitor from the X-Session-Id header; no IP addresses are stored.
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { SESSION_TOUCH_INTERVAL_MS } from '../constants';
import { prisma } from '../lib/prisma';

const sessionIdSchema = z.string().uuid();
/** When each session was last saved, to avoid a database write per request. */
const lastTouched = new Map<string, number>();

export const sessionMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const parsed = sessionIdSchema.safeParse(req.header('x-session-id'));
    if (!parsed.success) {
      next();
      return;
    }
    const sessionId = parsed.data;
    res.locals.sessionId = sessionId;

    const now = Date.now();
    const previous = lastTouched.get(sessionId);
    if (previous === undefined || now - previous > SESSION_TOUCH_INTERVAL_MS) {
      const userAgent = req.header('user-agent')?.slice(0, 512);
      await prisma.visitorSession.upsert({
        where: { id: sessionId },
        create: { id: sessionId, userAgent },
        update: { lastSeenAt: new Date() },
      });
      lastTouched.set(sessionId, now);
    }
    next();
  } catch (error) {
    next(error);
  }
};
