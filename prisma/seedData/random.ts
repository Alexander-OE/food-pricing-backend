// Seeded random helpers, so the mock data is the same on every seed.

export interface Random {
  next(): number; // 0 (inclusive) to 1 (exclusive)
  int(min: number, max: number): number; // inclusive both ends
  chance(probability: number): boolean;
  pick<T>(items: T[]): T;
  weighted<T>(items: T[], weights: number[]): T;
}

/** Small seeded generator (mulberry32). */
export function createRandom(seed: number): Random {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items, weights) => {
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let target = next() * total;
      for (let i = 0; i < items.length; i++) {
        target -= weights[i];
        if (target <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

/** Splits an array into chunks for batched inserts. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
