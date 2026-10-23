// Business logic for feedback: saving submitted messages.
import { prisma } from '../../lib/prisma';
import type { CreateFeedbackBody } from './feedback.schemas';

export async function createFeedback(sessionId: string | undefined, body: CreateFeedbackBody) {
  const commodity = body.commoditySlug
    ? await prisma.commodity.findUnique({
        where: { slug: body.commoditySlug },
        select: { id: true },
      })
    : null;

  const feedback = await prisma.feedback.create({
    data: {
      sessionId,
      name: body.name || undefined,
      email: body.email || undefined,
      category: body.category,
      message: body.message,
      commodityId: commodity?.id,
    },
  });
  return { id: feedback.id, status: feedback.status };
}
