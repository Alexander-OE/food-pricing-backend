import { app } from './app';
import { env } from './config/env';
import { startScheduler } from './jobs/scheduler';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

// Starts the HTTP server and cron jobs, and shuts down cleanly.
const server = app.listen(env.PORT, () => {
  logger.info(`API running on http://localhost:${env.PORT} (docs at /api/docs)`);
  if (env.ENABLE_CRON) startScheduler();
});


function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
