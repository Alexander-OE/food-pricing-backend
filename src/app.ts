// Builds the Express app, kept apart from server.ts so tests can use it.
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerDocument } from './config/swagger';
import { JSON_BODY_LIMIT } from './constants';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { globalLimiter } from './middleware/rateLimiters';
import { sessionMiddleware } from './middleware/session';
import { adminRouter } from './modules/admin/admin.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { commoditiesRouter } from './modules/commodities/commodities.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { feedbackRouter } from './modules/feedback/feedback.routes';
import { indicatorsRouter } from './modules/indicators/indicators.routes';
import { healthRouter, metaRouter } from './modules/meta/meta.routes';

export const app = express();

// Trust one proxy hop so rate limits see the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  }),
);
app.use(compression());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Docs sit outside the rate limiter and session tracking.
app.use(
  '/api/docs',
  // Swagger UI needs inline scripts, which helmet's default CSP blocks.
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, { swaggerOptions: { persistAuthorization: true } }),
);

// Photos load from another origin, so relax helmet's same-origin rule here.
app.use(
  '/images',
  helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  cors({ origin: env.CORS_ORIGIN }), // lets the frontend read credits.json
  express.static(path.resolve(process.cwd(), 'public/images'), { maxAge: '7d' }),
);

const api = express.Router();
api.use(globalLimiter);
api.use(sessionMiddleware);
api.use('/health', healthRouter);
api.use('/meta', metaRouter);
api.use('/dashboard', dashboardRouter);
api.use('/indicators', indicatorsRouter);
api.use('/commodities', commoditiesRouter);
api.use('/analytics', analyticsRouter);
api.use('/chat', chatRouter);
api.use('/feedback', feedbackRouter);
api.use('/admin', adminRouter);
app.use('/api/v1', api);

app.use(notFound);
app.use(errorHandler);
