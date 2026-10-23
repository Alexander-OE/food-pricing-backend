// Mock chatbot conversations and messages with realistic questions.
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { formatNaira } from '../../src/lib/format';
import type { CommodityCard } from '../../src/types';
import { createRandom } from './random';
import { pickCommodity, type CommodityRef, type SeededSession } from './usage';

const CONVERSATION_COUNT = 42;
// Chance of 1 to 8 user messages; many chats stop after 1 or 2 to show drop-off.
const LENGTH_WEIGHTS = [0.35, 0.25, 0.14, 0.1, 0.07, 0.04, 0.03, 0.02];
const SECONDS_BETWEEN_MESSAGES = { min: 20, max: 90 };
const FALLBACK_SHARE = 0.7;
const FALLBACK_LATENCY_MS = { min: 30, max: 200 };
const LLM_LATENCY_MS = { min: 900, max: 2800 };

// Opening questions, most popular first; {name} and {other} are filled in per chat.
const FIRST_QUESTIONS = [
  'Why is {name} so expensive now?',
  'Will {name} be cheaper next month?',
  'Is it better to buy {name} now or wait?',
  'How does diesel affect food prices?',
  'Which is cheaper this month, {name} or {other}?',
  'Will this trend continue?',
  'What is the best time to buy {name}?',
  'How does the dollar rate affect {name}?',
];
const FIRST_QUESTION_WEIGHTS = [10, 9, 8, 6, 5, 4, 3, 3];

const FOLLOW_UPS = [
  'Will this trend continue?',
  'Can I substitute {name} with something cheaper?',
  'How accurate is this forecast?',
  'What about next two months?',
  'Is it the harvest season?',
  'Thanks, that helps.',
  'Why is {name} expected to rise?',
  'Does the exchange rate matter for {name}?',
];

type Card = Pick<
  CommodityCard,
  'name' | 'unit' | 'currentPrice' | 'predictedPrice' | 'percentChange' | 'direction'
>;

/** Short template answer built from the commodity's real forecast. */
function templateReply(question: string, card: Card): string {
  const move =
    card.direction === 'UP'
      ? `rise about ${card.percentChange}%`
      : card.direction === 'DOWN'
        ? `fall about ${Math.abs(card.percentChange)}%`
        : 'stay about the same';
  const lower = question.toLowerCase();
  if (lower.includes('diesel'))
    return 'Most food reaches Lagos by truck, so when diesel gets dearer, transport costs rise and traders pass part of it on to buyers.';
  if (lower.includes('buy'))
    return `${card.name} is forecast to ${move} next month. This is an estimate, not a guarantee, so plan around your own budget.`;
  if (lower.includes('thanks')) return 'You are welcome! Ask me anything else about food prices.';
  return `${card.name} costs ${formatNaira(card.currentPrice)} per ${card.unit} now, and we expect it to ${move} next month (about ${formatNaira(card.predictedPrice)}). Forecasts are estimates.`;
}

function fill(template: string, name: string, other: string): string {
  return template.replace('{name}', name).replace('{other}', other);
}

export function buildChats(
  now: Date,
  sessions: SeededSession[],
  commodities: CommodityRef[],
  cardsBySlug: Map<string, Card>,
) {
  const random = createRandom(9103);
  const conversations: Prisma.ChatConversationCreateManyInput[] = [];
  const messages: Prisma.ChatMessageCreateManyInput[] = [];
  const events: Prisma.AnalyticsEventCreateManyInput[] = [];

  for (let i = 0; i < CONVERSATION_COUNT; i++) {
    const session = random.pick(sessions);
    const commodity = pickCommodity(commodities, random);
    const other = random.pick(commodities.filter((item) => item.slug !== commodity.slug));
    const card = cardsBySlug.get(commodity.slug);
    if (!card) continue;
    const otherName = cardsBySlug.get(other.slug)?.name ?? 'Yam';

    const userMessageCount = random.weighted([1, 2, 3, 4, 5, 6, 7, 8], LENGTH_WEIGHTS);
    const id = randomUUID();
    let time = new Date(
      Math.min(now.getTime(), session.firstSeenAt.getTime() + random.int(1, 10) * 60_000),
    );
    const startedAt = time;

    events.push({
      sessionId: session.id,
      type: 'CHAT_OPEN',
      path: `/commodities/${commodity.slug}`,
      commodityId: commodity.id,
      createdAt: startedAt,
    });

    for (let m = 0; m < userMessageCount; m++) {
      const template =
        m === 0
          ? random.weighted(FIRST_QUESTIONS, FIRST_QUESTION_WEIGHTS)
          : random.pick(FOLLOW_UPS);
      const question = fill(template, card.name, otherName);
      messages.push({ conversationId: id, role: 'USER', content: question, createdAt: time });

      const usedFallback = random.chance(FALLBACK_SHARE);
      const latency = usedFallback ? FALLBACK_LATENCY_MS : LLM_LATENCY_MS;
      const latencyMs = random.int(latency.min, latency.max);
      time = new Date(time.getTime() + latencyMs + 500);
      messages.push({
        conversationId: id,
        role: 'ASSISTANT',
        content: templateReply(question, card),
        latencyMs,
        usedFallback,
        createdAt: time,
      });
      time = new Date(
        time.getTime() +
          random.int(SECONDS_BETWEEN_MESSAGES.min, SECONDS_BETWEEN_MESSAGES.max) * 1000,
      );
    }

    conversations.push({
      id,
      sessionId: session.id,
      commodityId: commodity.id,
      messageCount: userMessageCount,
      startedAt,
      lastMessageAt: time,
    });
  }
  return { conversations, messages, events };
}
