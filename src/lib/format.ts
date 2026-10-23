// Small helpers for money, dates and percentages.
import type { Direction, Prisma } from '@prisma/client';
import { STABLE_THRESHOLD_PERCENT } from '../constants';

type DecimalLike = Prisma.Decimal | number | string;

/** Converts a Prisma Decimal to a number. */
export function toNumber(value: DecimalLike): number {
  return Number(value);
}

/** Formats a Date as "YYYY-MM-DD" in UTC. */
export function toPeriodString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parsePeriod(period: string): Date {
  return new Date(`${period}T00:00:00.000Z`);
}

/** Moves a date by whole months, always landing on the 1st. */
export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Percent change between two values, 0 when the start is 0. */
export function calculatePercentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return round(((to - from) / from) * 100, 1);
}

/** UP or DOWN beyond the stable threshold, otherwise STABLE. */
export function classifyDirection(percentChange: number): Direction {
  if (percentChange > STABLE_THRESHOLD_PERCENT) return 'UP';
  if (percentChange < -STABLE_THRESHOLD_PERCENT) return 'DOWN';
  return 'STABLE';
}

/** 1250 -> "₦1,250". */
export function formatNaira(value: number): string {
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value)}`;
}

export function monthLabel(date: Date): string {
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Start of the day N days ago (UTC). */
export function daysAgo(days: number, from: Date = new Date()): Date {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}
