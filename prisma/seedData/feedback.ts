// Mock feedback entries across all categories and statuses.
import type { FeedbackCategory, FeedbackStatus, Prisma } from '@prisma/client';
import { createRandom } from './random';
import type { CommodityRef, SeededSession } from './usage';

const FEEDBACK_COUNT = 35;
const DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MESSAGES: Record<FeedbackCategory, string[]> = {
  GENERAL: [
    'Nice app. It helped me plan my market run for the week.',
    'Very easy to use and clear. Please keep it free.',
    'I like that it explains why the price will change. Thank you.',
    'Can you add more states apart from Lagos?',
  ],
  BUG: [
    'The chart did not load on my phone the first time I opened the page.',
    'The search box sometimes shows no results until I refresh.',
    'The page looks cut off on my small Android phone.',
  ],
  PREDICTION_ACCURACY: [
    'The tomato price you predicted was lower than what I paid at Mile 12.',
    'Your rice forecast was very close to what I saw in the market. Good job!',
    'The egg price forecast looked too low compared with my local shop.',
    'How do you get these predictions? They seem to match the market well.',
  ],
  FEATURE_REQUEST: [
    'Please add a weekly price alert I can get on WhatsApp.',
    'Can you add the price of ugu and ewedu leaves?',
    'It would help to compare prices between different markets in Lagos.',
    'Add a Yoruba or Pidgin language option please.',
  ],
};
const CATEGORIES = Object.keys(MESSAGES) as FeedbackCategory[];
const STATUSES: FeedbackStatus[] = ['NEW', 'REVIEWED', 'RESOLVED'];
const STATUS_WEIGHTS = [0.45, 0.3, 0.25];
const NAMES = ['Adaeze', 'Tunde', 'Kemi', 'Ibrahim', 'Chioma', 'Seyi'];

export function buildFeedback(now: Date, sessions: SeededSession[], commodities: CommodityRef[]) {
  const random = createRandom(4242);
  const rows: Prisma.FeedbackCreateManyInput[] = [];

  for (let i = 0; i < FEEDBACK_COUNT; i++) {
    const category = random.pick(CATEGORIES);
    const named = random.chance(0.4);
    rows.push({
      sessionId: random.pick(sessions).id,
      name: named ? random.pick(NAMES) : undefined,
      email:
        named && random.chance(0.5)
          ? `${random.pick(NAMES).toLowerCase()}${random.int(1, 99)}@example.com`
          : undefined,
      category,
      message: random.pick(MESSAGES[category]),
      // Prediction feedback is often about a specific commodity
      commodityId:
        category === 'PREDICTION_ACCURACY' || random.chance(0.2)
          ? random.pick(commodities).id
          : undefined,
      status: random.weighted(STATUSES, STATUS_WEIGHTS),
      createdAt: new Date(
        now.getTime() - random.int(0, DAYS - 1) * MS_PER_DAY - random.int(0, 23) * 3_600_000,
      ),
    });
  }
  return rows;
}
