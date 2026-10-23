// Business logic for the admin feedback inbox: listing and changing status.
import { prisma } from '../../lib/prisma';
import type { FeedbackQuery, FeedbackUpdateBody } from './admin.schemas';

export async function listFeedback(query: FeedbackQuery) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { commodity: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.feedback.count({ where }),
  ]);
  return {
    total,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      category: item.category,
      message: item.message,
      status: item.status,
      commodityName: item.commodity?.name ?? null,
      createdAt: item.createdAt,
    })),
  };
}

export async function updateFeedbackStatus(id: number, body: FeedbackUpdateBody) {
  // A missing id throws P2025, which the error handler turns into a 404.
  const updated = await prisma.feedback.update({ where: { id }, data: { status: body.status } });
  return { id: updated.id, status: updated.status };
}
