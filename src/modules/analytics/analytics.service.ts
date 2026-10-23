// Business logic for usage events: saving page views, commodity views and searches.
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { TrackEventBody } from './analytics.schemas';

/** Saves one event; an unknown commodity slug is ignored. */
export async function trackEvent(sessionId: string, body: TrackEventBody): Promise<void> {
  const commodity = body.commoditySlug
    ? await prisma.commodity.findUnique({
        where: { slug: body.commoditySlug },
        select: { id: true },
      })
    : null;

  await prisma.analyticsEvent.create({
    data: {
      sessionId,
      type: body.type,
      path: body.path,
      commodityId: commodity?.id,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
