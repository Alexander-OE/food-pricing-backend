// Rule-based chatbot used when the AI is unavailable, answering from real forecast data.
import { formatNaira } from '../../lib/format';
import type { CommodityCard } from '../../types';
import type { ChatContext } from './promptBuilder';

type Intent =
  | 'investment'
  | 'off_topic'
  | 'greeting'
  | 'buy_or_wait'
  | 'compare'
  | 'diesel'
  | 'exchange_rate'
  | 'season'
  | 'budget'
  | 'future'
  | 'why';

/** Keyword lists per intent. The first intent that matches wins, so order matters. */
const INTENT_KEYWORDS: [Intent, RegExp][] = [
  ['investment', /\b(invest|investment|stock|stocks|bitcoin|crypto|forex trading|shares|loan)\b/],
  [
    'off_topic',
    /\b(president|election|football|soccer|movie|music|joke|weather|politic|religion|homework|code|programming|girlfriend|boyfriend)\b/,
  ],
  [
    'buy_or_wait',
    /\b(buy now|should i buy|wait|stock up|store|better to buy|buy early|buy later)\b/,
  ],
  ['compare', /\b(compare|versus|vs|which is)\b/],
  ['diesel', /\b(diesel|fuel|petrol|transport|trucks?|haulage)\b/],
  ['exchange_rate', /\b(dollar|exchange|naira|fx|forex|import(?:ed)?)\b/],
  ['season', /\b(season|seasonal|harvest|rain|rainy|dry season|festive|christmas)\b/],
  ['budget', /\b(budget|save money|saving|tips|afford|alternative|substitute)\b/],
  ['future', /\b(next month|future|trend|continue|forecast|predict|will|going to|expect|after)\b/],
  [
    'why',
    /\b(why|cause|reason|because|expensive|high|rising|rise|falling|drop|down|up|increase|decrease)\b/,
  ],
];

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|sup|how far)\b/;
const DISCLAIMER = 'Remember, this is an estimate and not a guarantee.';

function detectIntent(message: string): Intent | null {
  const text = message.toLowerCase().trim();
  if (GREETING.test(text) && text.split(/\s+/).length <= 5) return 'greeting';
  const match = INTENT_KEYWORDS.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : null;
}

/** "a rise of 12%" / "a drop of 5%" / "little change (0.8%)" */
function describeChange(card: Pick<CommodityCard, 'direction' | 'percentChange'>): string {
  const size = Math.abs(card.percentChange);
  if (card.direction === 'UP') return `a rise of about ${size}%`;
  if (card.direction === 'DOWN') return `a drop of about ${size}%`;
  return `little change (${card.percentChange}%)`;
}

/** Finds another commodity that the user named, e.g. "yam or potato". */
function findMentionedCommodity(
  message: string,
  others: CommodityCard[],
): CommodityCard | undefined {
  const text = message.toLowerCase();
  return others.find((card) => {
    const words = card.name
      .toLowerCase()
      .replace(/[()]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3);
    return text.includes(card.name.toLowerCase()) || words.some((word) => text.includes(word));
  });
}

function answerForecast({ detail }: ChatContext): string {
  const { name, unit, currentPrice, predictedPrice, lowerBound, upperBound, confidence } = detail;
  return [
    `${name} is expected to cost about ${formatNaira(predictedPrice)} per ${unit} next month, against ${formatNaira(currentPrice)} now. That means ${describeChange(detail)}.`,
    `Our estimated range is ${formatNaira(lowerBound)} to ${formatNaira(upperBound)}, with about ${Math.round(confidence * 100)}% model confidence.`,
    DISCLAIMER,
  ].join(' ');
}

function answerWhy({ detail }: ChatContext): string {
  const drivers = detail.factors
    .slice(0, 3)
    .map(
      (factor) =>
        `- **${factor.label}** (${factor.impactPercent > 0 ? '+' : ''}${factor.impactPercent}%): ${factor.detail}`,
    );
  return `${detail.explanation}\n\nThe main drivers are:\n${drivers.join('\n')}`;
}

function answerBuyOrWait({ detail }: ChatContext): string {
  const { name, direction, percentChange } = detail;
  let advice: string;
  if (direction === 'UP') {
    advice = `${name} is forecast to rise about ${percentChange}% next month, so buying a little earlier could save you money if you can store it safely.`;
  } else if (direction === 'DOWN') {
    advice = `${name} is forecast to fall about ${Math.abs(percentChange)}% next month, so waiting a few weeks could be cheaper if you do not need it urgently.`;
  } else {
    advice = `${name} is not expected to move much next month (${percentChange}%), so you can simply buy when you need it.`;
  }
  return `${advice} This is a price estimate, not financial advice. ${DISCLAIMER}`;
}

function answerCompare(context: ChatContext, message: string): string {
  const { detail, related } = context;
  const other = findMentionedCommodity(message, context.others);
  if (other) {
    const cheaper = other.currentPrice < detail.currentPrice ? other : detail;
    return `Right now ${detail.name} costs ${formatNaira(detail.currentPrice)} per ${detail.unit} and ${other.name} costs ${formatNaira(other.currentPrice)} per ${other.unit}, so ${cheaper.name} is cheaper at the moment. Next month we expect ${detail.name} to show ${describeChange(detail)} and ${other.name} to show ${describeChange(other)}. Check the units, as they may differ.`;
  }
  const list = related
    .map((item) => `${item.name} (${formatNaira(item.currentPrice)}, ${describeChange(item)})`)
    .join('; ');
  return `Tell me which item you want to compare with ${detail.name}. Related items you could check: ${list}.`;
}

function answerDiesel({ detail, indicators }: ChatContext): string {
  const diesel = indicators.find((item) => item.key === 'DIESEL_PRICE');
  const factor = detail.factors.find((item) => item.key === 'DIESEL_PRICE');
  const dieselText = diesel
    ? `Diesel is currently about ${formatNaira(diesel.value)} per litre (${diesel.changePercent}% vs last month).`
    : '';
  const impact = factor
    ? `For ${detail.name}, transport costs account for about ${factor.impactPercent > 0 ? '+' : ''}${factor.impactPercent}% of the predicted change.`
    : `Transport costs are not a major driver of the ${detail.name} forecast this month.`;
  return `Most food reaches Lagos by truck, so higher diesel means higher transport costs, and traders pass part of that to buyers. ${dieselText} ${impact}`.replace(
    /\s+/g,
    ' ',
  );
}

function answerExchangeRate({ detail, indicators }: ChatContext): string {
  const fx = indicators.find((item) => item.key === 'USD_NGN');
  const factor = detail.factors.find((item) => item.key === 'FX_RATE');
  const fxText = fx
    ? `The naira is around ₦${Math.round(fx.value)} per dollar (${fx.changePercent}% vs last month).`
    : '';
  const impact = factor
    ? `For ${detail.name}, the exchange rate explains about ${factor.impactPercent > 0 ? '+' : ''}${factor.impactPercent}% of the predicted change.`
    : `The exchange rate is a small factor for ${detail.name} this month.`;
  return `A weaker naira makes imported goods and farm inputs like feed, fertiliser and packaging more expensive. ${fxText} ${impact}`.replace(
    /\s+/g,
    ' ',
  );
}

function answerSeason({ detail }: ChatContext): string {
  const seasonal = detail.factors.find(
    (item) => item.key === 'SEASONALITY' || item.key === 'SUPPLY',
  );
  const note = seasonal
    ? seasonal.detail
    : `Seasonal effects are small for ${detail.name} this month.`;
  return `Harvest cycles affect how much food reaches the market. ${note} ${DISCLAIMER}`;
}

function answerBudget({ detail, related }: ChatContext): string {
  const falling = related.filter((item) => item.direction === 'DOWN').map((item) => item.name);
  const tip =
    falling.length > 0
      ? `${falling.join(' and ')} ${falling.length > 1 ? 'are' : 'is'} forecast to get cheaper, so they could be good swaps.`
      : 'Look at related items to see if any is cheaper.';
  return `Here are a few budgeting tips for ${detail.name}: buy in season when supply is high, compare prices across markets, and avoid stocking up on items that are about to get cheaper. ${tip}`;
}

function answerDefault(context: ChatContext): string {
  const { detail } = context;
  return `${detail.name} is ${formatNaira(detail.currentPrice)} per ${detail.unit} now and we expect ${describeChange(detail)} next month. You can ask me why it is moving, whether to buy now or wait, or how fuel and the dollar affect it.`;
}

/** Replies using only the real data in the context. */
export function respondWithRules(message: string, context: ChatContext): string {
  const { detail } = context;
  switch (detectIntent(message)) {
    case 'investment':
      return `I cannot give financial or investment advice. I can tell you what our forecast says about ${detail.name} prices in Lagos, though. ${answerForecast(context)}`;
    case 'off_topic':
      return `I can only help with food prices in Lagos. Ask me about ${detail.name}, why its price is moving, or how to budget for it.`;
    case 'greeting':
      return `Hello! I can explain the ${detail.name} forecast. For example, ask why the price is moving or whether to buy now or wait.`;
    case 'buy_or_wait':
      return answerBuyOrWait(context);
    case 'compare':
      return answerCompare(context, message);
    case 'diesel':
      return answerDiesel(context);
    case 'exchange_rate':
      return answerExchangeRate(context);
    case 'season':
      return answerSeason(context);
    case 'budget':
      return answerBudget(context);
    case 'future':
      return answerForecast(context);
    case 'why':
      return answerWhy(context);
    default:
      return answerDefault(context);
  }
}
