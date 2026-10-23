// Business logic for chat: starting conversations, building context and getting replies.
import type { ChatMessage } from '@prisma/client';
import { CHAT_HISTORY_LIMIT, SUGGESTED_QUESTION_COUNT } from '../../constants';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { LlmClient } from '../../ml-services/llm/LlmClient';
import { respondWithRules } from '../../ml-services/llm/fallbackResponder';
import { buildMessages, type ChatContext } from '../../ml-services/llm/promptBuilder';
import { ApiError } from '../../utils/ApiError';
import {
  buildCards,
  findCommodityOrThrow,
  getCommodityDetail,
} from '../commodities/commodities.service';
import { getLatestIndicators } from '../indicators/indicators.service';

const llm = new LlmClient();
const RELATED_FOR_CHAT = 3;

function toChatMessageDto(message: ChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    usedFallback: message.usedFallback,
  };
}

/** Gathers the facts the bot may use for one commodity. */
async function buildChatContext(slug: string): Promise<ChatContext> {
  const [detail, indicators, allCommodities] = await Promise.all([
    getCommodityDetail(slug),
    getLatestIndicators(['USD_NGN', 'DIESEL_PRICE', 'PETROL_PRICE', 'FOOD_INFLATION']),
    prisma.commodity.findMany({ where: { slug: { not: slug } } }),
  ]);
  const others = await buildCards(allCommodities);
  // Same-category items first, then the rest
  const related = [...others.filter((card) => card.category === detail.category), ...others].slice(
    0,
    RELATED_FOR_CHAT,
  );
  return { detail, indicators, related, others };
}

/** Greeting and starter questions based on the forecast. */
function buildGreeting(context: ChatContext) {
  const { detail, related } = context;
  const movement =
    detail.direction === 'UP'
      ? `go up ${detail.percentChange}%`
      : detail.direction === 'DOWN'
        ? `go down ${Math.abs(detail.percentChange)}%`
        : 'stay about the same';
  const greeting = `Hi! ${detail.name} is predicted to ${movement} next month. Ask me anything about why, or what it means for your shopping.`;

  const questions = [
    detail.direction === 'STABLE'
      ? `Why is ${detail.name} staying steady?`
      : `Why is ${detail.name} expected to ${detail.direction === 'UP' ? 'rise' : 'fall'}?`,
    `Is it better to buy ${detail.name} now or wait?`,
    detail.direction === 'STABLE'
      ? `What could change the ${detail.name} price?`
      : 'Will this trend continue?',
    related[0]
      ? `Which is cheaper this month, ${detail.name} or ${related[0].name}?`
      : `How does diesel affect ${detail.name} prices?`,
  ];
  return { greeting, suggestedQuestions: questions.slice(0, SUGGESTED_QUESTION_COUNT) };
}

export async function startConversation(sessionId: string, commoditySlug: string) {
  const commodity = await findCommodityOrThrow(commoditySlug);
  const context = await buildChatContext(commoditySlug);

  const conversation = await prisma.chatConversation.create({
    data: { sessionId, commodityId: commodity.id },
  });
  await prisma.analyticsEvent.create({
    data: {
      sessionId,
      type: 'CHAT_OPEN',
      path: `/commodities/${commodity.slug}`,
      commodityId: commodity.id,
    },
  });
  return { conversationId: conversation.id, ...buildGreeting(context) };
}

/** Another session's conversation looks like it does not exist (404). */
async function getOwnedConversation(id: string, sessionId: string) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id },
    include: { commodity: { select: { slug: true } } },
  });
  if (!conversation || conversation.sessionId !== sessionId)
    throw ApiError.notFound('Conversation not found');
  return conversation;
}

/** Uses the AI model when configured, otherwise (or on failure) the rule-based reply. */
async function generateReply(context: ChatContext, conversationId: string, userMessage: string) {
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: CHAT_HISTORY_LIMIT,
  });
  // Drop the message just saved, since it is sent separately.
  const history = recent.reverse().slice(0, -1);

  if (llm.isConfigured()) {
    try {
      const content = await llm.complete(buildMessages(context, history, userMessage));
      return { content, usedFallback: false };
    } catch (error) {
      logger.warn({ err: error }, 'LLM failed, using fallback responder');
    }
  }
  return { content: respondWithRules(userMessage, context), usedFallback: true };
}

export async function sendMessage(conversationId: string, sessionId: string, message: string) {
  const conversation = await getOwnedConversation(conversationId, sessionId);
  const startedAt = Date.now();

  await prisma.chatMessage.create({ data: { conversationId, role: 'USER', content: message } });
  const context = await buildChatContext(conversation.commodity.slug);
  const reply = await generateReply(context, conversationId, message);

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: reply.content,
      usedFallback: reply.usedFallback,
      latencyMs: Date.now() - startedAt,
    },
  });
  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    // messageCount counts only the user's messages.
    data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
  });

  return {
    reply: toChatMessageDto(assistantMessage),
    conversation: { id: updated.id, messageCount: updated.messageCount },
  };
}

export async function getConversation(conversationId: string, sessionId: string) {
  const conversation = await getOwnedConversation(conversationId, sessionId);
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
  return {
    id: conversation.id,
    commoditySlug: conversation.commodity.slug,
    messageCount: conversation.messageCount,
    messages: messages.map(toChatMessageDto),
  };
}
