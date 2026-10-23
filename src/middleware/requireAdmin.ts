// Checks the admin Bearer token on protected routes.
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { AdminIdentity } from '../types';
import { ApiError } from '../utils/ApiError';

interface AdminTokenPayload {
  sub: string;
  email: string;
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized());
    return;
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as AdminTokenPayload;
    const identity: AdminIdentity = { id: Number(payload.sub), email: payload.email };
    res.locals.admin = identity;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};
