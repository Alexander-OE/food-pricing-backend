// Generates the MOCK ml-data files; the same seed always gives the same output.
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'ml-data');
const RANDOM_SEED = 20260930;
const START_YEAR = 2020;
const MONTH_COUNT = 60; // Jan 2020 to Dec 2024
const PRICE_ROUNDING = 10; // prices are rounded to the nearest 10 naira

// ---------- seeded random numbers ----------

/** Seeded random generator (mulberry32), so output never changes between runs. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(RANDOM_SEED);

/** Normal-distributed random number (Box-Muller), clamped to +/- 2 standard deviations. */
function gaussian(): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2, Math.min(2, value));
}

// ---------- calendar helpers ----------

/** "YYYY-MM-01" for a month index (0 = Jan 2020). */
function periodOf(index: number): string {
  const year = START_YEAR + Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function indexOfLabel(label: string): number {
  const [year, month] = label.split('-').map(Number);
  return (year - START_YEAR) * 12 + (month - 1);
}

// ---------- commodity definitions ----------

type Category =
  'GRAINS' | 'LEGUMES' | 'TUBERS' | 'VEGETABLES' | 'FRUITS' | 'PROTEIN' | 'OILS' | 'OTHERS';
type SeasonProfile = 'tomato' | 'yam' | 'grain' | 'onion' | 'processed' | 'festive' | 'mild';
type NoiseLevel = 'fresh' | 'mid' | 'processed';

interface CommoditySpec {
  name: string;
  slug: string;
  category: Category;
  unit: string;
  latestPrice: number;
  season: SeasonProfile;
  noise: NoiseLevel;
  description: string;
  // sensitivities: how strongly each factor moves this commodity (0 to 1)
  fx: number;
  diesel: number;
  seasonality: number;
  supply: number;
  inflation: number;
}

const COMMODITIES: CommoditySpec[] = [
  {
    name: 'Rice (Local)',
    slug: 'rice-local',
    category: 'GRAINS',
    unit: '1kg',
    latestPrice: 1900,
    season: 'grain',
    noise: 'mid',
    description:
      'Locally milled rice from northern states such as Kebbi and Ebonyi. Price follows harvest size and transport cost to Lagos.',
    fx: 0.3,
    diesel: 0.5,
    seasonality: 0.5,
    supply: 0.6,
    inflation: 0.5,
  },
  {
    name: 'Rice (Imported)',
    slug: 'rice-imported',
    category: 'GRAINS',
    unit: '1kg',
    latestPrice: 2400,
    season: 'processed',
    noise: 'processed',
    description:
      'Foreign parboiled rice sold in Lagos markets. Its price moves closely with the dollar exchange rate.',
    fx: 0.9,
    diesel: 0.3,
    seasonality: 0.1,
    supply: 0.2,
    inflation: 0.5,
  },
  {
    name: 'Maize (White)',
    slug: 'maize-white',
    category: 'GRAINS',
    unit: '1kg',
    latestPrice: 900,
    season: 'grain',
    noise: 'mid',
    description:
      'Dry white maize grain used for pap, flour and animal feed. Price drops after harvest and rises in the lean months.',
    fx: 0.1,
    diesel: 0.5,
    seasonality: 0.7,
    supply: 0.8,
    inflation: 0.4,
  },
  {
    name: 'Sliced Bread',
    slug: 'sliced-bread',
    category: 'GRAINS',
    unit: '500g loaf',
    latestPrice: 1600,
    season: 'processed',
    noise: 'processed',
    description:
      'Factory-baked bread. Wheat is imported, so the exchange rate and energy costs matter most.',
    fx: 0.85,
    diesel: 0.4,
    seasonality: 0.05,
    supply: 0.1,
    inflation: 0.6,
  },
  {
    name: 'Spaghetti',
    slug: 'spaghetti',
    category: 'GRAINS',
    unit: '500g pack',
    latestPrice: 1300,
    season: 'processed',
    noise: 'processed',
    description:
      'Packaged pasta made from imported wheat. Price follows the exchange rate and factory costs.',
    fx: 0.85,
    diesel: 0.4,
    seasonality: 0.05,
    supply: 0.1,
    inflation: 0.6,
  },
  {
    name: 'Beans (Brown)',
    slug: 'beans-brown',
    category: 'LEGUMES',
    unit: '1kg',
    latestPrice: 2600,
    season: 'grain',
    noise: 'mid',
    description:
      'Brown beans (Oloyin) from the north. Supply depends on harvest and the long trip to Lagos.',
    fx: 0.2,
    diesel: 0.6,
    seasonality: 0.6,
    supply: 0.8,
    inflation: 0.4,
  },
  {
    name: 'Beans (White)',
    slug: 'beans-white',
    category: 'LEGUMES',
    unit: '1kg',
    latestPrice: 2200,
    season: 'grain',
    noise: 'mid',
    description:
      'White beans (Ife Brown and similar) from the north. Price tracks harvest size and transport.',
    fx: 0.2,
    diesel: 0.6,
    seasonality: 0.6,
    supply: 0.8,
    inflation: 0.4,
  },
  {
    name: 'Yam',
    slug: 'yam',
    category: 'TUBERS',
    unit: '1kg',
    latestPrice: 1500,
    season: 'yam',
    noise: 'mid',
    description:
      'Yam tubers from the middle belt. Prices peak mid-year and fall once new yam arrives from August.',
    fx: 0.1,
    diesel: 0.5,
    seasonality: 0.8,
    supply: 0.9,
    inflation: 0.4,
  },
  {
    name: 'Irish Potato',
    slug: 'irish-potato',
    category: 'TUBERS',
    unit: '1kg',
    latestPrice: 1800,
    season: 'mild',
    noise: 'mid',
    description:
      'Potatoes grown mainly around Jos. Price depends on supply from the plateau and transport.',
    fx: 0.2,
    diesel: 0.6,
    seasonality: 0.4,
    supply: 0.7,
    inflation: 0.4,
  },
  {
    name: 'Sweet Potato',
    slug: 'sweet-potato',
    category: 'TUBERS',
    unit: '1kg',
    latestPrice: 900,
    season: 'mild',
    noise: 'fresh',
    description:
      'Sweet potato from southwestern and northern farms. Cheap and fairly steady through the year.',
    fx: 0.05,
    diesel: 0.5,
    seasonality: 0.4,
    supply: 0.7,
    inflation: 0.4,
  },
  {
    name: 'Garri (White)',
    slug: 'garri-white',
    category: 'TUBERS',
    unit: '1kg',
    latestPrice: 1300,
    season: 'mild',
    noise: 'mid',
    description: 'Fermented cassava granules, a staple across Lagos. Price follows cassava supply.',
    fx: 0.1,
    diesel: 0.4,
    seasonality: 0.4,
    supply: 0.85,
    inflation: 0.4,
  },
  {
    name: 'Garri (Yellow)',
    slug: 'garri-yellow',
    category: 'TUBERS',
    unit: '1kg',
    latestPrice: 1400,
    season: 'mild',
    noise: 'mid',
    description: 'Cassava granules fried with palm oil. Moves with cassava and palm oil supply.',
    fx: 0.1,
    diesel: 0.4,
    seasonality: 0.4,
    supply: 0.85,
    inflation: 0.4,
  },
  {
    name: 'Tomato',
    slug: 'tomato',
    category: 'VEGETABLES',
    unit: '1kg',
    latestPrice: 2200,
    season: 'tomato',
    noise: 'fresh',
    description:
      'Fresh tomatoes trucked from Kano, Kaduna and Jos. Fragile and seasonal, so price swings a lot.',
    fx: 0.1,
    diesel: 0.85,
    seasonality: 0.9,
    supply: 0.8,
    inflation: 0.3,
  },
  {
    name: 'Onion',
    slug: 'onion',
    category: 'VEGETABLES',
    unit: '1kg',
    latestPrice: 1600,
    season: 'onion',
    noise: 'fresh',
    description:
      'Red onions from the north, mostly Sokoto and Kano. Price rises when stored stock runs low.',
    fx: 0.1,
    diesel: 0.75,
    seasonality: 0.7,
    supply: 0.7,
    inflation: 0.3,
  },
  {
    name: 'Fresh Pepper',
    slug: 'fresh-pepper',
    category: 'VEGETABLES',
    unit: '1kg',
    latestPrice: 2500,
    season: 'tomato',
    noise: 'fresh',
    description:
      'Tatashe and rodo peppers from farms around Lagos and the north. Very sensitive to season and transport.',
    fx: 0.1,
    diesel: 0.8,
    seasonality: 0.9,
    supply: 0.8,
    inflation: 0.3,
  },
  {
    name: 'Carrot',
    slug: 'carrot',
    category: 'VEGETABLES',
    unit: '1kg',
    latestPrice: 1500,
    season: 'mild',
    noise: 'fresh',
    description:
      'Carrots grown on the Jos plateau. Price follows supply and the cost of moving it south.',
    fx: 0.1,
    diesel: 0.7,
    seasonality: 0.5,
    supply: 0.6,
    inflation: 0.3,
  },
  {
    name: 'Plantain (Unripe)',
    slug: 'plantain',
    category: 'FRUITS',
    unit: '1kg',
    latestPrice: 1400,
    season: 'mild',
    noise: 'fresh',
    description:
      'Unripe plantain from the southwest and south-south. Fairly steady, with small seasonal moves.',
    fx: 0.05,
    diesel: 0.5,
    seasonality: 0.4,
    supply: 0.6,
    inflation: 0.4,
  },
  {
    name: 'Beef (Boneless)',
    slug: 'beef',
    category: 'PROTEIN',
    unit: '1kg',
    latestPrice: 8500,
    season: 'mild',
    noise: 'mid',
    description:
      'Boneless cow meat from Lagos abattoirs. Cattle come from the north, so transport and general inflation matter.',
    fx: 0.2,
    diesel: 0.5,
    seasonality: 0.1,
    supply: 0.4,
    inflation: 0.7,
  },
  {
    name: 'Whole Chicken',
    slug: 'chicken',
    category: 'PROTEIN',
    unit: '1kg',
    latestPrice: 7500,
    season: 'festive',
    noise: 'mid',
    description:
      'Frozen or fresh whole chicken. Feed is largely imported, and demand jumps at Christmas.',
    fx: 0.6,
    diesel: 0.4,
    seasonality: 0.3,
    supply: 0.3,
    inflation: 0.6,
  },
  {
    name: 'Frozen Fish (Mackerel)',
    slug: 'frozen-fish',
    category: 'PROTEIN',
    unit: '1kg',
    latestPrice: 5500,
    season: 'mild',
    noise: 'mid',
    description:
      'Imported frozen mackerel (Titus). Price follows the exchange rate and import costs.',
    fx: 0.8,
    diesel: 0.3,
    seasonality: 0.1,
    supply: 0.2,
    inflation: 0.5,
  },
  {
    name: 'Eggs',
    slug: 'eggs',
    category: 'PROTEIN',
    unit: 'crate of 30',
    latestPrice: 6000,
    season: 'festive',
    noise: 'mid',
    description:
      'Table eggs from poultry farms around Lagos and Ogun. Feed costs drive the price, with a bump in December.',
    fx: 0.6,
    diesel: 0.4,
    seasonality: 0.3,
    supply: 0.3,
    inflation: 0.6,
  },
  {
    name: 'Vegetable Oil',
    slug: 'vegetable-oil',
    category: 'OILS',
    unit: '1 litre',
    latestPrice: 3200,
    season: 'processed',
    noise: 'processed',
    description:
      'Refined cooking oil. Raw materials are partly imported, so the exchange rate has a strong effect.',
    fx: 0.85,
    diesel: 0.35,
    seasonality: 0.05,
    supply: 0.2,
    inflation: 0.6,
  },
  {
    name: 'Palm Oil',
    slug: 'palm-oil',
    category: 'OILS',
    unit: '1 litre',
    latestPrice: 2800,
    season: 'mild',
    noise: 'mid',
    description: 'Red palm oil from the south. Output is seasonal and transport adds to the cost.',
    fx: 0.2,
    diesel: 0.5,
    seasonality: 0.4,
    supply: 0.7,
    inflation: 0.5,
  },
  {
    name: 'Sugar',
    slug: 'sugar',
    category: 'OTHERS',
    unit: '1kg',
    latestPrice: 1900,
    season: 'processed',
    noise: 'processed',
    description:
      'Granulated sugar, mostly refined from imported raw sugar. Follows the exchange rate closely.',
    fx: 0.85,
    diesel: 0.35,
    seasonality: 0.05,
    supply: 0.15,
    inflation: 0.6,
  },
  {
    name: 'Powdered Milk',
    slug: 'powdered-milk',
    category: 'OTHERS',
    unit: '400g tin',
    latestPrice: 3500,
    season: 'processed',
    noise: 'processed',
    description: 'Imported milk powder in tins. Price is driven by the dollar and import costs.',
    fx: 0.95,
    diesel: 0.25,
    seasonality: 0.02,
    supply: 0.1,
    inflation: 0.6,
  },
];

// ---------- seasonality ----------

/** Cosine-shaped yearly pattern: peaks in peakMonth (1-12) and swings by `amplitude`. */
function cosineProfile(peakMonth: number, amplitude: number): number[] {
  return Array.from(
    { length: 12 },
    (_, i) => 1 + amplitude * Math.cos((2 * Math.PI * (i + 1 - peakMonth)) / 12),
  );
}

/** Scales a 12-value profile so its average is exactly 1.0 over a year. */
function normalise(profile: number[]): number[] {
  const mean = profile.reduce((sum, value) => sum + value, 0) / profile.length;
  return profile.map((value) => value / mean);
}

const SEASON_PROFILES: Record<SeasonProfile, number[]> = {
  tomato: normalise(cosineProfile(5, 0.25)), // high Mar-Jul, low Nov-Feb
  yam: normalise([0.97, 0.98, 1.0, 1.02, 1.05, 1.12, 1.15, 1.0, 0.92, 0.88, 0.9, 0.95]), // peak Jun-Jul, new yam from Aug
  grain: normalise(cosineProfile(7, 0.08)), // low after harvest (Oct-Dec), high May-Aug
  onion: normalise(cosineProfile(7, 0.15)),
  processed: normalise(cosineProfile(6, 0.02)),
  festive: normalise([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.02, 1.07]), // December bump
  mild: normalise(cosineProfile(6, 0.05)),
};

const NOISE_SD: Record<NoiseLevel, number> = { fresh: 0.05, mid: 0.03, processed: 0.02 };

// ---------- general price level (inflation path) ----------

const ANNUAL_INFLATION: Record<number, number> = {
  2020: 0.16,
  2021: 0.18,
  2022: 0.2,
  2023: 0.28,
  2024: 0.4,
};
const SUBSIDY_JUMP_START = indexOfLabel('2023-06');
const SUBSIDY_JUMP_END = indexOfLabel('2023-09');
const SUBSIDY_JUMP_TOTAL = 1.2; // extra 20% across Jun-Sep 2023 (subsidy removal + naira float)

/** General price level for every month, scaled so the last month (Dec 2024) equals 1. */
function buildPriceLevel(): number[] {
  const level: number[] = [1];
  for (let i = 1; i < MONTH_COUNT; i++) {
    const year = START_YEAR + Math.floor(i / 12);
    let growth = Math.pow(1 + ANNUAL_INFLATION[year], 1 / 12);
    if (i >= SUBSIDY_JUMP_START && i <= SUBSIDY_JUMP_END) {
      growth *= Math.pow(SUBSIDY_JUMP_TOTAL, 1 / (SUBSIDY_JUMP_END - SUBSIDY_JUMP_START + 1));
    }
    level.push(level[i - 1] * growth);
  }
  const last = level[MONTH_COUNT - 1];
  return level.map((value) => value / last);
}

// ---------- prices ----------

interface PriceRow {
  period: string;
  commodity_slug: string;
  price: number;
  source: string;
}

/** Builds the price rows for one commodity by back-casting from its Dec 2024 price. */
function buildPrices(spec: CommoditySpec, priceLevel: number[]): PriceRow[] {
  const profile = SEASON_PROFILES[spec.season];
  const lastMonthFactor = profile[(MONTH_COUNT - 1) % 12]; // so the last month lands on the target price
  let drift = 0; // slow wandering component so products do not all move identically
  return Array.from({ length: MONTH_COUNT }, (_, i) => {
    const isLastMonth = i === MONTH_COUNT - 1;
    drift = 0.8 * drift + 0.01 * gaussian();
    const noise = isLastMonth ? 0 : NOISE_SD[spec.noise] * gaussian() + drift;
    const seasonal = profile[i % 12] / lastMonthFactor;
    const raw = spec.latestPrice * priceLevel[i] * seasonal * (1 + noise);
    const rounded = Math.max(PRICE_ROUNDING, Math.round(raw / PRICE_ROUNDING) * PRICE_ROUNDING);
    return { period: periodOf(i), commodity_slug: spec.slug, price: rounded, source: 'MOCK' };
  });
}

// ---------- macro indicators ----------

type Anchor = [label: string, value: number];

/** Straight-line interpolation between anchor points. */
function interpolate(anchors: Anchor[], index: number): number {
  const points = anchors.map(([label, value]) => ({ at: indexOfLabel(label), value }));
  if (index <= points[0].at) return points[0].value;
  for (let p = 1; p < points.length; p++) {
    if (index <= points[p].at) {
      const span = points[p].at - points[p - 1].at;
      const share = span === 0 ? 1 : (index - points[p - 1].at) / span;
      return points[p - 1].value + share * (points[p].value - points[p - 1].value);
    }
  }
  return points[points.length - 1].value;
}

const USD_NGN: Anchor[] = [
  ['2020-01', 360],
  ['2021-01', 410],
  ['2023-05', 460],
  ['2023-08', 770],
  ['2024-02', 1500],
  ['2024-12', 1600],
];
const DIESEL: Anchor[] = [
  ['2020-01', 220],
  ['2021-12', 260],
  ['2022-11', 800],
  ['2023-05', 850],
  ['2023-09', 1100],
  ['2024-06', 1250],
  ['2024-12', 1650],
];
const PETROL: Anchor[] = [
  ['2020-01', 145],
  ['2023-05', 145],
  ['2023-06', 620],
  ['2024-06', 650],
  ['2024-10', 1000],
  ['2024-12', 1000],
];
const HEADLINE: Anchor[] = [
  ['2020-01', 12.2],
  ['2020-12', 15.8],
  ['2021-12', 15.6],
  ['2022-12', 21.3],
  ['2023-12', 28],
  ['2024-11', 34.6],
  ['2024-12', 34.8],
];

interface IndicatorRow {
  period: string;
  key: string;
  value: number;
}

/** Builds every indicator series, one row per month per key. */
function buildIndicators(): IndicatorRow[] {
  const rows: IndicatorRow[] = [];
  const round = (value: number, digits = 1) => Number(value.toFixed(digits));
  for (let i = 0; i < MONTH_COUNT; i++) {
    const period = periodOf(i);
    const month = (i % 12) + 1;
    const headline = interpolate(HEADLINE, i) + 0.3 * gaussian();
    const rainfall = 50 + 45 * Math.cos((2 * Math.PI * (month - 7.5)) / 12) + 5 * gaussian();
    const supply = 50 + 35 * Math.cos((2 * Math.PI * (month - 11)) / 12) + 4 * gaussian();
    rows.push(
      { period, key: 'USD_NGN', value: round(interpolate(USD_NGN, i) * (1 + 0.01 * gaussian())) },
      {
        period,
        key: 'DIESEL_PRICE',
        value: round(interpolate(DIESEL, i) * (1 + 0.01 * gaussian())),
      },
      {
        period,
        key: 'PETROL_PRICE',
        value: round(interpolate(PETROL, i) * (1 + 0.005 * gaussian())),
      },
      { period, key: 'HEADLINE_INFLATION', value: round(headline) },
      {
        period,
        key: 'FOOD_INFLATION',
        value: round(headline + 3.5 + 1.5 * Math.sin(i / 5) + 0.3 * gaussian()),
      },
      { period, key: 'RAINFALL_INDEX', value: round(Math.max(0, Math.min(100, rainfall))) },
      { period, key: 'SUPPLY_INDEX', value: round(Math.max(0, Math.min(100, supply))) },
    );
  }
  return rows;
}

// ---------- write the files ----------

function writeFiles(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const priceLevel = buildPriceLevel();

  const commodityFile = COMMODITIES.map((spec) => ({
    name: spec.name,
    slug: spec.slug,
    category: spec.category,
    unit: spec.unit,
    description: spec.description,
    latestPrice: spec.latestPrice,
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'commodities.json'),
    JSON.stringify(commodityFile, null, 2) + '\n',
  );

  const priceRows = COMMODITIES.flatMap((spec) => buildPrices(spec, priceLevel));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'lagos_food_prices.csv'),
    stringify(priceRows, { header: true }),
  );

  const indicatorRows = buildIndicators();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'macro_indicators.csv'),
    stringify(indicatorRows, { header: true }),
  );

  const sensitivities: Record<string, Record<string, number>> = {};
  for (const spec of COMMODITIES) {
    sensitivities[spec.slug] = {
      fx: spec.fx,
      diesel: spec.diesel,
      seasonality: spec.seasonality,
      supply: spec.supply,
      inflation: spec.inflation,
    };
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'commodity_sensitivities.json'),
    JSON.stringify(sensitivities, null, 2) + '\n',
  );

  console.log(
    `Wrote ${COMMODITIES.length} commodities, ${priceRows.length} price rows, ${indicatorRows.length} indicator rows.`,
  );
}

writeFiles();
