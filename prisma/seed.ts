// Seeds the database with demo data; safe to re-run, because it clears every table first.
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';
import { BACKTEST_MONTHS, BCRYPT_ROUNDS, COMMODITY_IMAGES_PATH } from '../src/constants';
import { addMonths } from '../src/lib/format';
import { prisma } from '../src/lib/prisma';
import { buildCards } from '../src/modules/commodities/commodities.service';
import { evaluateAccuracy } from '../src/ml-services/pipeline/evaluateAccuracy';
import { generatePredictionsForPeriod } from '../src/ml-services/pipeline/generatePredictions';
import { getLatestPricePeriod } from '../src/ml-services/pipeline/ingestPrices';
import {
  readCommodityFile,
  readIndicatorFile,
  readPriceFile,
} from '../src/ml-services/pipeline/mlData';
import { buildChats } from './seedData/chats';
import { buildFeedback } from './seedData/feedback';
import { chunk } from './seedData/random';
import { buildRefreshLogs } from './seedData/refreshLogs';
import { buildSessionsAndEvents } from './seedData/usage';

const BATCH_SIZE = 1000;

/** Deletes children before parents so foreign keys do not complain. */
async function clearTables(): Promise<void> {
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.visitorSession.deleteMany();
  await prisma.predictionAccuracy.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.priceRecord.deleteMany();
  await prisma.macroIndicator.deleteMany();
  await prisma.dataRefreshLog.deleteMany();
  await prisma.commodity.deleteMany();
  await prisma.admin.deleteMany();
}

async function seedAdmin(): Promise<void> {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_ROUNDS);
  await prisma.admin.create({
    data: { email: env.ADMIN_EMAIL.toLowerCase(), passwordHash, name: env.ADMIN_NAME },
  });
}

async function seedCommoditiesAndData(): Promise<void> {
  await prisma.commodity.createMany({
    data: readCommodityFile().map((item) => ({
      name: item.name,
      slug: item.slug,
      category: item.category,
      unit: item.unit,
      description: item.description,
      imageUrl: `${COMMODITY_IMAGES_PATH}/${item.slug}.jpg`,
    })),
  });

  const commodities = await prisma.commodity.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(commodities.map((commodity) => [commodity.slug, commodity.id]));

  const prices = readPriceFile().map((row) => ({
    commodityId: idBySlug.get(row.commoditySlug) as number,
    period: row.period,
    price: row.price,
    source: 'MOCK' as const,
  }));
  for (const batch of chunk(prices, BATCH_SIZE))
    await prisma.priceRecord.createMany({ data: batch });
  for (const batch of chunk(readIndicatorFile(), BATCH_SIZE))
    await prisma.macroIndicator.createMany({ data: batch });
}

/** Back-tests recent months using only earlier data, then makes the current prediction. */
async function seedPredictions(latest: Date): Promise<void> {
  for (let back = BACKTEST_MONTHS; back >= 0; back--) {
    await generatePredictionsForPeriod(addMonths(latest, -back));
  }
  await evaluateAccuracy();
}

async function seedMockAnalytics(now: Date): Promise<void> {
  const commodities = await prisma.commodity.findMany({
    select: { id: true, slug: true },
  });
  const cards = await buildCards(await prisma.commodity.findMany());
  const cardsBySlug = new Map(cards.map((card) => [card.slug, card]));

  const usage = buildSessionsAndEvents(now, commodities);
  const chats = buildChats(now, usage.seeded, commodities, cardsBySlug);
  const feedback = buildFeedback(now, usage.seeded, commodities);

  for (const batch of chunk(usage.sessions, BATCH_SIZE))
    await prisma.visitorSession.createMany({ data: batch });
  for (const batch of chunk([...usage.events, ...chats.events], BATCH_SIZE))
    await prisma.analyticsEvent.createMany({ data: batch });
  await prisma.chatConversation.createMany({ data: chats.conversations });
  for (const batch of chunk(chats.messages, BATCH_SIZE))
    await prisma.chatMessage.createMany({ data: batch });
  await prisma.feedback.createMany({ data: feedback });

  console.log(
    `  sessions ${usage.sessions.length}, events ${usage.events.length + chats.events.length}, ` +
      `conversations ${chats.conversations.length}, messages ${chats.messages.length}, feedback ${feedback.length}`,
  );
}

async function main(): Promise<void> {
  const now = new Date();
  console.log('Clearing tables...');
  await clearTables();
  console.log('Seeding admin, commodities, prices and indicators...');
  await seedAdmin();
  await seedCommoditiesAndData();

  const latest = await getLatestPricePeriod();
  if (!latest) throw new Error('No price data found after seeding');

  console.log('Back-testing 12 months of predictions and making the current forecast...');
  await seedPredictions(latest);

  console.log('Adding refresh logs and mock analytics...');
  await prisma.dataRefreshLog.createMany({ data: buildRefreshLogs(now, latest) });
  await seedMockAnalytics(now);

  const [predictions, accuracy] = await Promise.all([
    prisma.prediction.count(),
    prisma.predictionAccuracy.count(),
  ]);
  console.log(`Done. Predictions: ${predictions}, scored: ${accuracy}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
