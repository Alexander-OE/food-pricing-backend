// Builds the AI prompt: rules, facts about the commodity and recent chat history.
import { formatNaira } from '../../lib/format';
import type { CommodityDetail } from '../../modules/commodities/commodities.service';
import type { LatestIndicator } from '../../modules/indicators/indicators.service';
import type { CommodityCard } from '../../types';
import type { LlmMessage } from './LlmClient';

/** Everything the bot may know about the commodity. */
export interface ChatContext {
  detail: CommodityDetail;
  indicators: LatestIndicator[];
  related: CommodityCard[]; // 3 related commodities
  others: CommodityCard[]; // every other commodity (used by the fallback for comparisons)
}

export interface HistoryMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

const SYSTEM_PROMPT = `You are FoodCast, a friendly assistant inside a Lagos (Nigeria) food price forecast app.
Rules:
- Speak plain, warm English that everyday Nigerians understand. Keep answers short: 2 to 5 sentences. Use bullet points only when listing.
- Only use the numbers given in the CONTEXT block. Never invent prices, percentages or dates.
- Always make clear that forecasts are estimates, not guarantees.
- Only discuss food prices, the current commodity, its prediction and factors, related commodities, market conditions in Lagos, and general food budgeting tips.
- Never give financial or investment advice. Politely decline anything off-topic and steer back to food prices.`;

/** Plain-text facts from real database values. */
function buildContextBlock({ detail, indicators, related }: ChatContext): string {
  const lines = [
    `Commodity: ${detail.name} (${detail.unit}), category ${detail.category}`,
    `Current price: ${formatNaira(detail.currentPrice)} (month-on-month ${detail.monthOnMonthChange}%)`,
    `Forecast for ${detail.targetPeriod}: ${formatNaira(detail.predictedPrice)} (range ${formatNaira(detail.lowerBound)} to ${formatNaira(detail.upperBound)}), change ${detail.percentChange}%, direction ${detail.direction}, confidence ${Math.round(detail.confidence * 100)}%`,
    `Factors: ${detail.factors.map((factor) => `${factor.label} ${factor.impactPercent > 0 ? '+' : ''}${factor.impactPercent}% (${factor.detail})`).join(' | ')}`,
    `Market indicators: ${indicators.map((item) => `${item.key} ${item.value} (${item.changePercent}% vs last month)`).join(', ')}`,
  ];
  if (detail.lastMonthTrackRecord) {
    const record = detail.lastMonthTrackRecord;
    lines.push(
      `Last month's track record: predicted ${formatNaira(record.predictedPrice)}, actual ${formatNaira(record.actualPrice)} (${record.percentError}% off)`,
    );
  }
  lines.push(
    `Related commodities: ${related.map((item) => `${item.name} now ${formatNaira(item.currentPrice)}, forecast ${formatNaira(item.predictedPrice)} (${item.percentChange}%, ${item.direction})`).join(' | ')}`,
  );
  return lines.join('\n');
}

/** Combines the system prompt, context, recent history and the new message. */
export function buildMessages(
  context: ChatContext,
  history: HistoryMessage[],
  userMessage: string,
): LlmMessage[] {
  return [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${buildContextBlock(context)}` },
    ...history.map((message): LlmMessage => ({
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
    })),
    { role: 'user', content: userMessage },
  ];
}
