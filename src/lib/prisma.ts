// The single Prisma client; only services talk to the database.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

// Prisma 7 connects to PostgreSQL through this driver adapter.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
