// Handles requests for service health and data status.
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ok } from '../../utils/response';
import { getDataStatus } from './meta.service';

/** Also pings the database so a broken connection shows up. */
export async function getHealth(_req: Request, res: Response) {
  let db: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  ok(res, {
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
}

export async function getStatus(_req: Request, res: Response) {
  ok(res, await getDataStatus());
}
