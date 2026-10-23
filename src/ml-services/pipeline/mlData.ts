// Reads the mock NBS-style files in ml-data/ for the seed and the ingest steps.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { CommodityCategory, IndicatorKey } from '@prisma/client';
import { parsePeriod } from '../../lib/format';

const ML_DATA_DIR = path.resolve(process.cwd(), 'ml-data');

export interface CommodityFileRow {
  name: string;
  slug: string;
  category: CommodityCategory;
  unit: string;
  description: string;
  latestPrice: number;
}

export interface PriceFileRow {
  period: Date;
  commoditySlug: string;
  price: number;
}

export interface IndicatorFileRow {
  period: Date;
  key: IndicatorKey;
  value: number;
}

function readCsv(fileName: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(ML_DATA_DIR, fileName), 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

export function readCommodityFile(): CommodityFileRow[] {
  const text = fs.readFileSync(path.join(ML_DATA_DIR, 'commodities.json'), 'utf8');
  return JSON.parse(text) as CommodityFileRow[];
}

export function readPriceFile(): PriceFileRow[] {
  return readCsv('lagos_food_prices.csv').map((row) => ({
    period: parsePeriod(row.period),
    commoditySlug: row.commodity_slug,
    price: Number(row.price),
  }));
}

export function readIndicatorFile(): IndicatorFileRow[] {
  return readCsv('macro_indicators.csv').map((row) => ({
    period: parsePeriod(row.period),
    key: row.key as IndicatorKey,
    value: Number(row.value),
  }));
}
