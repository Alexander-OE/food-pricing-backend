// Builds ml-data/lagos_food_prices.csv and macro_indicators.csv from the real source files in ml-data/sources.
// Run with `npm run data:generate`. ml-data/SOURCES.md explains every source and how gaps are filled.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const DATA_DIR = path.resolve(__dirname, '..', 'ml-data');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');
const FIRST_MONTH = '2018-01';
const LAST_MONTH = '2026-05'; // latest month NBS has published food prices for
const LAST_OLD_LIST_MONTH = '2024-12'; // NBS changed its item list in January 2025

type Row = Record<string, string>;
type Series = Map<string, number>; // "YYYY-MM" -> value

/** One monthly price in the output, with where it came from. */
interface PricePoint {
  value: number;
  source: string;
  real: boolean; // false means it was estimated between real prices
}

// ---------- small helpers ----------

function readCsv(fileName: string): Row[] {
  return parse(fs.readFileSync(path.join(SOURCES_DIR, fileName), 'utf8'), {
    columns: true,
  }) as Row[];
}

/** Every month from FIRST_MONTH to LAST_MONTH as "YYYY-MM". */
function allMonths(): string[] {
  const months: string[] = [];
  for (let y = Number(FIRST_MONTH.slice(0, 4)); y <= Number(LAST_MONTH.slice(0, 4)); y++) {
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2, '0')}`;
      if (month >= FIRST_MONTH && month <= LAST_MONTH) months.push(month);
    }
  }
  return months;
}
const MONTHS = allMonths();

/** Months since January of year 0, so the gap between two months is a simple subtraction. */
function monthNumber(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

/** True when a table's item name is the wanted item (ignoring spacing and case, and NBS's ",specify bottle" suffix). */
function sameItem(tableName: string, wanted: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return clean(tableName) === clean(wanted) || clean(tableName).startsWith(`${clean(wanted)},`);
}

/**
 * Estimates a month that has no real price. Between two real prices it follows the shape of a related
 * real series (the "guide"), then spreads the leftover difference evenly so it lands on the next real price.
 */
function estimate(month: string, anchors: Series, guide: Series): number | null {
  const anchorMonths = [...anchors.keys()].sort();
  const before = anchorMonths.filter((m) => m < month).pop();
  const after = anchorMonths.find((m) => m > month);
  const g = (m: string | undefined) => (m ? guide.get(m) : undefined);
  const value = (m: string) => anchors.get(m)!;

  if (before && after) {
    const share =
      (monthNumber(month) - monthNumber(before)) / (monthNumber(after) - monthNumber(before));
    if (g(month) && g(before) && g(after)) {
      const drift = value(after) / value(before) / (g(after)! / g(before)!);
      return value(before) * (g(month)! / g(before)!) * drift ** share;
    }
    // No guide available: grow at a steady monthly rate between the two real prices
    return value(before) * (value(after) / value(before)) ** share;
  }
  if (before && g(month) && g(before)) return value(before) * (g(month)! / g(before)!);
  if (after && g(month) && g(after)) return value(after) * (g(month)! / g(after)!);
  return null;
}

// ---------- NBS food prices ----------

const nbsLagos = readCsv('nbs_lagos_2018_2024.csv'); // real NBS Lagos prices, old item list
const nbsTables = readCsv('nbs_tables_2024_2026.csv'); // NBS national and South-West averages, new item list

/** A national NBS average for one item and month. */
function nbsNational(month: string, item: string): number {
  const row = nbsTables.find((r) => r.period === month && sameItem(r.nbs_item, item));
  if (!row) throw new Error(`NBS national average missing: ${item} ${month}`);
  return Number(row.national);
}

// NBS priced eggs per dozen until 2024 and per crate of 30 from 2025. A crate costs less per egg,
// so the conversion uses NBS's own national prices: Jan 2025 crate price / Dec 2024 dozen price.
const EGG_CRATE_FACTOR =
  nbsNational('2025-01', 'Agric hen eggs, (a Crate of 30 pieces)') /
  nbsNational('2024-12', 'Agric eggs medium size');

/** How a series maps to NBS items; the factors convert NBS units into the app's unit. */
interface NbsRecipe {
  oldItem: string; // NBS name until Dec 2024
  newItem: string; // NBS name from Jan 2025
  oldFactor: number;
  newFactor: number;
}

const NBS_RECIPES: Record<string, NbsRecipe> = {
  'rice-local': {
    oldItem: 'Rice local sold loose',
    newItem: 'Rice Local, short-Grained',
    oldFactor: 1,
    newFactor: 1,
  },
  'rice-imported': {
    oldItem: 'Rice,imported high quality sold loose',
    newItem: 'Rice Long-Grained (Imported)',
    oldFactor: 1,
    newFactor: 1,
  },
  'maize-white': {
    oldItem: 'Maize grain white sold loose',
    newItem: 'Maize (Corn) Grains (White) sold loose',
    oldFactor: 1,
    newFactor: 1,
  },
  'sliced-bread': {
    oldItem: 'Bread sliced 500g',
    newItem: 'Bread (sliced), 450g',
    oldFactor: 1,
    newFactor: 500 / 450,
  },
  'beans-brown': {
    oldItem: 'Beans brown,sold loose',
    newItem: 'Beans Brown',
    oldFactor: 1,
    newFactor: 1,
  },
  'beans-white': {
    oldItem: 'Beans:white black eye. sold loose',
    newItem: 'Beans white',
    oldFactor: 1,
    newFactor: 1,
  },
  yam: { oldItem: 'Yam tuber', newItem: 'Yam Tuber', oldFactor: 1, newFactor: 1 },
  'irish-potato': { oldItem: 'Irish potato', newItem: 'Irish Potatoe', oldFactor: 1, newFactor: 1 },
  'sweet-potato': {
    oldItem: 'Sweet potato',
    newItem: 'Sweet potatoes',
    oldFactor: 1,
    newFactor: 1,
  },
  'garri-white': {
    oldItem: 'Gari white,sold loose',
    newItem: 'Garri white',
    oldFactor: 1,
    newFactor: 1,
  },
  'garri-yellow': {
    oldItem: 'Gari yellow,sold loose',
    newItem: 'Garri Yellow',
    oldFactor: 1,
    newFactor: 1,
  },
  tomato: { oldItem: 'Tomato', newItem: 'Tomatoes, fresh', oldFactor: 1, newFactor: 1 },
  onion: { oldItem: 'Onion bulb', newItem: 'Onions, fresh', oldFactor: 1, newFactor: 1 },
  plantain: {
    oldItem: 'Plantain(unripe)',
    newItem: 'Plantain (unripe)',
    oldFactor: 1,
    newFactor: 1,
  },
  beef: { oldItem: 'Beef,boneless', newItem: 'Beef Boneless', oldFactor: 1, newFactor: 1 },
  chicken: {
    oldItem: 'Frozen chicken',
    newItem: 'Chicken meat (Frozen)',
    oldFactor: 1,
    newFactor: 1,
  },
  'frozen-fish': {
    oldItem: 'Mackerel : frozen',
    newItem: 'Mackerel, Frozen',
    oldFactor: 1,
    newFactor: 1,
  },
  eggs: {
    oldItem: 'Agric eggs medium size',
    newItem: 'Agric hen eggs, (a Crate of 30 pieces)',
    oldFactor: EGG_CRATE_FACTOR,
    newFactor: 1,
  },
  'vegetable-oil': {
    oldItem: 'Vegetable oil:1 bottle',
    newItem: 'Vegetable Oil, 75cl',
    oldFactor: 1,
    newFactor: 100 / 75,
  },
  'palm-oil': {
    oldItem: 'Palm oil: 1 bottle',
    newItem: 'Palm oil, 75cl',
    oldFactor: 1,
    newFactor: 100 / 75,
  },
  // Guides for commodities NBS does not cover (not commodities themselves)
  'guide:wheat-flour': {
    oldItem: 'Wheat flour: prepacked (golden penny 2kg)',
    newItem: 'Wheat Flour, Prepacked (2kg)',
    oldFactor: 1,
    newFactor: 1,
  },
  'guide:peak-evaporated-milk': {
    oldItem: 'Evaporated tinned milk(peak), 170g',
    newItem: 'Tin Milk-Evaporated, Peak Milk, 150g',
    oldFactor: 1,
    newFactor: 170 / 150,
  },
};

/**
 * Real NBS Lagos prices until Dec 2024. After that, months follow the NBS South-West average,
 * pinned to real Lagos prices wherever NBS names Lagos as the highest or lowest state.
 */
function buildNbsSeries(recipe: NbsRecipe): Map<string, PricePoint> {
  const points = new Map<string, PricePoint>();
  const anchors: Series = new Map();
  for (const row of nbsLagos.filter((r) => r.nbs_item === recipe.oldItem)) {
    const value = Number(row.price) * recipe.oldFactor;
    points.set(row.period, { value, source: 'NBS Lagos', real: true });
    anchors.set(row.period, value);
  }

  const guide: Series = new Map();
  for (const row of nbsTables) {
    if (!row.south_west) continue;
    const isOld = row.period <= LAST_OLD_LIST_MONTH;
    if (sameItem(row.nbs_item, isOld ? recipe.oldItem : recipe.newItem)) {
      guide.set(row.period, Number(row.south_west) * (isOld ? recipe.oldFactor : recipe.newFactor));
    }
    if (!isOld && row.lagos_if_named && sameItem(row.nbs_item, recipe.newItem)) {
      anchors.set(row.period, Number(row.lagos_if_named) * recipe.newFactor);
    }
  }

  for (const month of MONTHS.filter((m) => m > LAST_OLD_LIST_MONTH)) {
    if (anchors.has(month))
      points.set(month, { value: anchors.get(month)!, source: 'NBS Lagos', real: true });
    else
      points.set(month, {
        value: estimate(month, anchors, guide)!,
        source: 'NBS South-West average',
        real: false,
      });
  }
  return points;
}

const nbsSeries = new Map(
  Object.entries(NBS_RECIPES).map(([key, recipe]) => [key, buildNbsSeries(recipe)]),
);

// ---------- commodities NBS does not cover ----------

const marketAnchors = readCsv('market_anchors.csv');

/** Which real series guides each of these commodities between its real prices. */
const GUIDES: Record<string, string> = {
  spaghetti: 'guide:wheat-flour', // same input and the same Golden Penny brand
  sugar: 'guide:wheat-flour', // imported processed staple, moves with the exchange rate
  'powdered-milk': 'guide:peak-evaporated-milk', // same Peak brand
  'fresh-pepper': 'tomato', // sold alongside tomatoes with a similar season
  carrot: 'irish-potato', // both come mostly from the Jos plateau
};

/** Builds a commodity from scattered real prices, filling the months between them with its guide. */
function buildFromAnchors(slug: string): Map<string, PricePoint> {
  const anchors: Series = new Map();
  const real = new Map<string, { real: boolean; source: string }>();
  for (const row of marketAnchors.filter((r) => r.commodity_slug === slug)) {
    anchors.set(row.period, Number(row.price));
    real.set(row.period, { real: row.basis === 'real', source: row.source });
  }
  // Carrot only joined the NBS list in 2025; its South-West average is used from then on
  if (slug === 'carrot') {
    for (const row of nbsTables.filter(
      (r) => sameItem(r.nbs_item, 'Carrots, fresh') && r.south_west,
    )) {
      anchors.set(row.period, Number(row.south_west));
      real.set(row.period, { real: false, source: 'NBS South-West average' });
    }
  }
  const guidePoints = nbsSeries.get(GUIDES[slug])!;
  const guide: Series = new Map([...guidePoints].map(([m, p]) => [m, p.value]));

  const points = new Map<string, PricePoint>();
  for (const month of MONTHS) {
    if (anchors.has(month)) points.set(month, { value: anchors.get(month)!, ...real.get(month)! });
    else
      points.set(month, {
        value: estimate(month, anchors, guide)!,
        source: 'Estimated',
        real: false,
      });
  }
  return points;
}

// ---------- write the price file ----------

const commodities = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'commodities.json'), 'utf8'),
) as {
  slug: string;
  latestPrice: number;
}[];

const priceRows: (string | number)[][] = [];
const summary: string[] = [];
for (const commodity of commodities) {
  const series = NBS_RECIPES[commodity.slug]
    ? nbsSeries.get(commodity.slug)!
    : buildFromAnchors(commodity.slug);
  let realCount = 0;
  for (const month of MONTHS) {
    const point = series.get(month);
    if (!point || !Number.isFinite(point.value))
      throw new Error(`No price for ${commodity.slug} ${month}`);
    if (point.real) realCount++;
    priceRows.push([
      `${month}-01`,
      commodity.slug,
      Math.round(point.value * 100) / 100,
      point.source,
      point.real ? 'real' : 'estimated',
    ]);
  }
  commodity.latestPrice = Math.round(series.get(LAST_MONTH)!.value);
  summary.push(
    `${commodity.slug.padEnd(15)} real ${String(realCount).padStart(3)}  estimated ${String(MONTHS.length - realCount).padStart(3)}`,
  );
}

fs.writeFileSync(
  path.join(DATA_DIR, 'lagos_food_prices.csv'),
  stringify(priceRows, {
    header: true,
    columns: ['period', 'commodity_slug', 'price', 'source', 'basis'],
  }),
);
fs.writeFileSync(
  path.join(DATA_DIR, 'commodities.json'),
  JSON.stringify(commodities, null, 2) + '\n',
);

// ---------- macro indicators ----------

const macroRaw = readCsv('macro_raw.csv');
const macroRows: (string | number)[][] = [];

/** Real values for one key, with any missing month filled by a straight line between its neighbours. */
function macroSeries(key: string): Series {
  const known: Series = new Map(
    macroRaw.filter((r) => r.key === key).map((r) => [r.period, Number(r.value)]),
  );
  const out: Series = new Map();
  for (const month of MONTHS)
    out.set(month, known.get(month) ?? estimate(month, known, new Map())!);
  return out;
}

for (const key of [
  'USD_NGN',
  'DIESEL_PRICE',
  'PETROL_PRICE',
  'HEADLINE_INFLATION',
  'FOOD_INFLATION',
]) {
  for (const [month, value] of macroSeries(key))
    macroRows.push([`${month}-01`, key, Math.round(value * 100) / 100]);
}

// Rainfall index: each month's rainfall as a share of the wettest month in the period (0 to 100)
const rainfall = macroSeries('RAINFALL_MM');
const wettest = Math.max(...rainfall.values());
for (const [month, mm] of rainfall)
  macroRows.push([`${month}-01`, 'RAINFALL_INDEX', Math.round((mm / wettest) * 1000) / 10]);

// Supply index: no measured series exists, so it follows the crop calendar (high after the Sep-Dec harvest, low in the May lean season)
for (const month of MONTHS) {
  const calendarMonth = Number(month.slice(5, 7));
  const supply = 50 + 35 * Math.cos((2 * Math.PI * (calendarMonth - 11)) / 12);
  macroRows.push([`${month}-01`, 'SUPPLY_INDEX', Math.round(supply * 10) / 10]);
}

macroRows.sort(
  (a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])),
);
fs.writeFileSync(
  path.join(DATA_DIR, 'macro_indicators.csv'),
  stringify(macroRows, { header: true, columns: ['period', 'key', 'value'] }),
);

console.log(
  `Wrote ${priceRows.length} price rows and ${macroRows.length} indicator rows (${FIRST_MONTH} to ${LAST_MONTH}).`,
);
console.log(`Egg crate factor (crate of 30 / dozen): ${EGG_CRATE_FACTOR.toFixed(3)}`);
console.log(summary.join('\n'));
