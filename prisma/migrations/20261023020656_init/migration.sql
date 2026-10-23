-- CreateEnum
CREATE TYPE "CommodityCategory" AS ENUM ('GRAINS', 'LEGUMES', 'TUBERS', 'VEGETABLES', 'FRUITS', 'PROTEIN', 'OILS', 'OTHERS');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('NBS', 'MOCK');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('UP', 'DOWN', 'STABLE');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "IndicatorKey" AS ENUM ('USD_NGN', 'DIESEL_PRICE', 'PETROL_PRICE', 'HEADLINE_INFLATION', 'FOOD_INFLATION', 'RAINFALL_INDEX', 'SUPPLY_INDEX');

-- CreateEnum
CREATE TYPE "RefreshType" AS ENUM ('NBS_PRICES', 'MACRO_FEATURES', 'PREDICTIONS', 'ACCURACY');

-- CreateEnum
CREATE TYPE "RefreshStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PAGE_VIEW', 'COMMODITY_VIEW', 'SEARCH', 'CHAT_OPEN');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('GENERAL', 'BUG', 'PREDICTION_ACCURACY', 'FEATURE_REQUEST');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Commodity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "CommodityCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" SERIAL NOT NULL,
    "commodityId" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "source" "PriceSource" NOT NULL DEFAULT 'MOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" SERIAL NOT NULL,
    "commodityId" INTEGER NOT NULL,
    "basePeriod" DATE NOT NULL,
    "targetPeriod" DATE NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "predictedPrice" DECIMAL(12,2) NOT NULL,
    "lowerBound" DECIMAL(12,2) NOT NULL,
    "upperBound" DECIMAL(12,2) NOT NULL,
    "percentChange" DOUBLE PRECISION NOT NULL,
    "direction" "Direction" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionAccuracy" (
    "id" SERIAL NOT NULL,
    "predictionId" INTEGER NOT NULL,
    "actualPrice" DECIMAL(12,2) NOT NULL,
    "absoluteError" DECIMAL(12,2) NOT NULL,
    "percentError" DOUBLE PRECISION NOT NULL,
    "directionHit" BOOLEAN NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroIndicator" (
    "id" SERIAL NOT NULL,
    "key" "IndicatorKey" NOT NULL,
    "period" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MacroIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRefreshLog" (
    "id" SERIAL NOT NULL,
    "type" "RefreshType" NOT NULL,
    "status" "RefreshStatus" NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "dataPeriod" DATE,
    "errorMessage" TEXT,

    CONSTRAINT "DataRefreshLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorSession" (
    "id" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" VARCHAR(512),

    CONSTRAINT "VisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "commodityId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commodityId" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'GENERAL',
    "message" TEXT NOT NULL,
    "commodityId" INTEGER,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_slug_key" ON "Commodity"("slug");

-- CreateIndex
CREATE INDEX "PriceRecord_period_idx" ON "PriceRecord"("period");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRecord_commodityId_period_key" ON "PriceRecord"("commodityId", "period");

-- CreateIndex
CREATE INDEX "Prediction_targetPeriod_idx" ON "Prediction"("targetPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_commodityId_targetPeriod_key" ON "Prediction"("commodityId", "targetPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionAccuracy_predictionId_key" ON "PredictionAccuracy"("predictionId");

-- CreateIndex
CREATE UNIQUE INDEX "MacroIndicator_key_period_key" ON "MacroIndicator"("key", "period");

-- CreateIndex
CREATE INDEX "DataRefreshLog_type_startedAt_idx" ON "DataRefreshLog"("type", "startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_commodityId_idx" ON "AnalyticsEvent"("commodityId");

-- CreateIndex
CREATE INDEX "ChatConversation_startedAt_idx" ON "ChatConversation"("startedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
