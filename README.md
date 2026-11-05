# Lagos Food Price Forecast API (`food-pricing-backend`)

A REST API that forecasts **next month's prices for 25 common foods in Lagos, Nigeria** (rice, yam, tomato, garri, eggs, palm oil and more). For each food it returns a predicted price, a likely price range, a confidence score, whether the price is going **up, down or staying stable**, and a plain-English explanation of why. It is built for shoppers, traders and anyone budgeting for food in Lagos, and it powers a separate web frontend and an admin dashboard.

> **Heads up:** the price data in this repo is a snapshot of Lagos prices (January 2018 to May 2026) built mostly from National Bureau of Statistics (NBS) figures, with some months estimated. See [ml-data/SOURCES.md](ml-data/SOURCES.md) for exactly what is real and what is estimated.

---

## Table of contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [How the forecasting works](#4-how-the-forecasting-works)
5. [Getting started](#5-getting-started)
6. [Environment variables](#6-environment-variables)
7. [npm scripts](#7-npm-scripts)
8. [API overview](#8-api-overview)
9. [Database](#9-database)
10. [Testing, linting and formatting](#10-testing-linting-and-formatting)
11. [Deployment (Neon + Render)](#11-deployment-neon--render)
12. [Troubleshooting](#12-troubleshooting)
13. [Frontend, contributing and license](#13-frontend-contributing-and-license)

---

## 1. Features

| Feature | What it does |
|---|---|
| **Price forecasts** | A predicted price for next month for each of the 25 foods, with a lower and upper bound (an 80% range). |
| **Confidence scores** | A number from 0.55 to 0.92 for every forecast. A tighter price range means higher confidence. |
| **Direction** | `UP`, `DOWN` or `STABLE`. A forecast change within ±2% counts as `STABLE`. |
| **Price history** | Monthly price history for each food, plus the forecast point. |
| **Accuracy tracking** | Past forecasts are scored against the real price once it is known (percent error and whether the direction was right). |
| **Market indicators** | Latest USD/NGN exchange rate, diesel, petrol and food inflation, with the monthly change. |
| **Usage analytics** | Anonymous page views, commodity views and searches, recorded against a visitor-chosen session ID (no IP addresses stored). |
| **Feedback** | Visitors can send feedback; admins can review it and mark it `NEW`, `REVIEWED` or `RESOLVED`. |
| **AI chat explanations** | A chat per commodity, answered by Google Gemini. If no API key is set, or Gemini fails, a rule-based responder answers from the real forecast data instead. |
| **Admin login** | Email and password login that returns a JWT. Admin routes cover an overview, analytics, data freshness, accuracy, feedback and manual data refreshes. |
| **Monthly cron pipeline** | On the 16th of each month at 07:00 (Lagos time) the API loads new data, scores old forecasts and makes new ones. A lighter indicator refresh runs daily at 06:00. |
| **Rate limiting** | Separate limits for general traffic, chat, feedback, analytics and admin login. |
| **Swagger docs** | Interactive API docs served by the app itself. |

---

## 2. Tech stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 5 |
| Language | TypeScript |
| ORM | Prisma 7 (using the `@prisma/adapter-pg` driver adapter) |
| Database | PostgreSQL |
| Validation | Zod |
| Auth | JSON Web Tokens (`jsonwebtoken`) and `bcryptjs` for password hashes |
| LLM (chat) | Google Gemini via `@google/generative-ai` (default model `gemini-2.5-flash`) |
| Forecasting | A **local, in-process model** (default), with an **optional remote model server** you point to over HTTP |
| Scheduling | `node-cron` |
| Security and ops | `helmet`, `cors`, `compression`, `express-rate-limit`, `pino` logging |
| API docs | `swagger-ui-express` |
| Tests | Vitest and Supertest |
| Code quality | ESLint and Prettier |

---

## 3. Architecture

### How a request flows

```
Frontend / client
       |
       v
  Express app  (src/app.ts)
       |  helmet -> cors -> compression -> JSON body parser -> request logger
       v
  /api/v1 router
       |  global rate limiter -> session middleware (reads X-Session-Id)
       v
  Module routes   ->  validate (Zod)  ->  controller  ->  service  ->  Prisma  ->  PostgreSQL
  (e.g. commodities)                     (HTTP only)      (logic)
       |
       v
  Standard response: { success, data, meta } or { success: false, error }
```

Admin routes add one more step: `requireAdmin` checks the `Authorization: Bearer <token>` header before the controller runs.

### How forecasts get into the database

```
node-cron (or POST /admin/data/refresh, or npm run pipeline:run)
       |
       v
  Monthly pipeline:  1. ingest prices  ->  2. ingest indicators  ->  3. score old forecasts  ->  4. generate new forecasts
                                                                                                          |
                                                                                    MODEL_PROVIDER=local  |  MODEL_PROVIDER=remote
                                                                                    (built-in model)      |  (HTTP call to MODEL_SERVER_URL)
                                                                                                          |  if it fails -> local model
```

### Folder structure

```
food-pricing-backend/
├── ml-data/                  Price and indicator data files (CSV/JSON) used to seed and refresh the database
│   └── sources/              Raw source figures that the data files are built from
├── prisma/
│   ├── schema.prisma         Database models and enums
│   ├── migrations/           SQL migrations (currently one: init)
│   ├── seed.ts               Fills the database with demo data (see Getting started)
│   └── seedData/             Helpers that generate mock visitors, chats, feedback and refresh logs
├── prisma.config.ts          Prisma CLI config: schema path, migrations path, seed command, DATABASE_URL
├── public/images/commodities/  Photos of each food, served at /images/commodities/<slug>.jpg (credits in CREDITS.md)
├── scripts/                  One-off scripts (build-ml-data.ts rebuilds the data files from ml-data/sources)
├── src/
│   ├── app.ts                Builds the Express app (middleware, routes); also used by tests
│   ├── server.ts             Starts the HTTP server and cron jobs, and shuts down cleanly
│   ├── constants.ts          Named settings: thresholds, rate limits, cron schedules, timeouts
│   ├── config/               env.ts (checks environment variables) and swagger.ts (API docs)
│   ├── jobs/                 scheduler.ts: the daily and monthly cron jobs
│   ├── lib/                  Shared helpers: Prisma client, logger, formatting
│   ├── middleware/           Error handler, 404, rate limiters, admin auth, session tracking, validation
│   ├── ml-services/
│   │   ├── model/            Forecast models: local, remote client, and the fallback logic
│   │   ├── pipeline/         Monthly pipeline steps: ingest prices, ingest indicators, score accuracy, generate predictions
│   │   ├── llm/              Gemini client, prompt builder and the rule-based fallback chatbot
│   │   └── explanation.ts    Turns forecast factors into plain-English sentences
│   ├── modules/              One folder per feature: routes, controller, schemas, service
│   │   ├── admin/            Admin login, overview, analytics, data status/refresh, accuracy, feedback inbox
│   │   ├── analytics/        Visitor event tracking
│   │   ├── chat/             Chat conversations about a commodity
│   │   ├── commodities/      Commodity list, detail, history, accuracy, related items
│   │   ├── dashboard/        Market summary across all commodities
│   │   ├── feedback/         Visitor feedback form
│   │   ├── indicators/       Latest exchange rate, diesel, petrol and inflation
│   │   ├── meta/             Health check and data status
│   │   └── predictions/      Shared prediction logic used by other modules
│   ├── types/                Shared TypeScript types
│   └── utils/                ApiError, asyncHandler and the response helpers
└── tests/                    Vitest API tests (api.test.ts) and setup
```

Each module follows the same pattern: **routes** (URLs) → **schemas** (Zod validation) → **controller** (HTTP in/out) → **service** (the real logic and database calls).

---

## 4. How the forecasting works

### Where the data comes from

The data lives in [ml-data/](ml-data/):

- `lagos_food_prices.csv`: monthly Lagos prices (naira) for 25 foods, January 2018 to May 2026. Each row says whether it is `real` or `estimated`.
- `macro_indicators.csv`: seven monthly indicators: USD/NGN, diesel price, petrol price, headline inflation, food inflation, a rainfall index and a supply index.
- `commodities.json` and `commodity_sensitivities.json`: the 25 foods, and how strongly each one reacts to exchange rate, diesel, season and supply.

The environment variable `DATA_SOURCE=mock` (the default) reads these files. A value of `nbs` exists but is **not connected yet**: the pipeline will stop with a clear error if you set it. Run `npm run data:generate` to rebuild the data files from the raw figures in `ml-data/sources/`.

### What the built-in model does

For each food, the local model (`local-baseline-v1`) looks at the last 36 months of prices and adds up five effects:

1. **Trend**: the recent monthly growth rate, from a straight-line fit on the last 12 months of (log) prices.
2. **Seasonality**: how this calendar month has usually moved compared with an average month.
3. **Diesel**: the recent change in diesel price, scaled by how sensitive that food is to transport costs.
4. **Exchange rate**: the recent change in the naira/dollar rate, scaled the same way.
5. **Supply**: more supply pushes the price down, less pushes it up.

The macro effects are scaled down and capped so no single factor can move a forecast by more than 8%. The sum becomes the predicted price. The **range** is an 80% interval based on how bumpy the recent price history was, and the **confidence** is higher when that range is tighter (between 0.55 and 0.92).

The backend, not the model, then works out the percent change and the direction (`UP`/`DOWN`/`STABLE`) so the rules are the same whichever model is used, and writes a plain-English explanation from the top 3 to 4 factors.

### Back-testing and accuracy

When you seed the database, the seed script "replays" the last 12 months: for each month it makes a forecast using **only data available up to that month**, so the test is honest. Once the real price for a forecast month is in the database, the **accuracy step** scores it:

- **Percent error**: how far off the prediction was, as a share of the real price.
- **Direction hit**: whether `UP`, `DOWN` or `STABLE` was called correctly.

### The monthly pipeline

Run on the 16th of each month at 07:00 Africa/Lagos time (shortly after the NBS usually publishes). Steps run in this order, and a failed step does not stop the others:

| # | Step (`RefreshType`) | What it does |
|---|---|---|
| 1 | `NBS_PRICES` | Adds price rows that are missing from the database. |
| 2 | `MACRO_FEATURES` | Adds indicator rows that are missing. This step also runs on its own every day at 06:00. |
| 3 | `ACCURACY` | Scores past forecasts whose real price is now known. It runs before new predictions on purpose. |
| 4 | `PREDICTIONS` | Forecasts the month after the latest month with price data, and marks older forecasts `SUPERSEDED`. |

Every step writes a row to the `DataRefreshLog` table, which admins can read.

> **Note:** with `DATA_SOURCE=mock`, steps 1 and 2 only read the files already in `ml-data/`. They do not download anything. New months appear only after the files are updated and the pipeline runs.

### Remote model and the fallback

Set `MODEL_PROVIDER=remote` and `MODEL_SERVER_URL` to use your own model server. The API sends `POST {MODEL_SERVER_URL}/predict` with `{ "inputs": [...] }` and expects `{ "predictions": [...] }` back (the exact shapes are in [src/ml-services/model/ModelProvider.ts](src/ml-services/model/ModelProvider.ts) and [RemoteModelClient.ts](src/ml-services/model/RemoteModelClient.ts)). The response is checked with Zod, and the request retries once on a network error or timeout.

**If the remote server is unreachable, times out, returns an error or sends a badly shaped response, the API falls back to the local model**, so the site never shows empty forecasts. The failure is saved as a `FAILED` row with trigger `model-fallback` in `DataRefreshLog`, so admins can see why.

> **TODO:** a comment in `RemoteModelClient.ts` says the request/response format is still to be confirmed with the model's author.

---

## 5. Getting started

### Prerequisites

- **Node.js** and **npm**. A recent version is needed because of Prisma 7 and the TypeScript tooling (Node 20.19 or newer is a safe choice). *TODO: `package.json` has no `engines` field, so no exact version is enforced.*
- **PostgreSQL** installed and running (or a free [Neon](https://neon.tech) database).
- **Git**.
- *Optional:* a Google Gemini API key for AI chat. Without it, chat still works using the rule-based responder.

### Steps

**1. Clone and install**

```bash
git clone https://github.com/Alexander-OE/food-pricing-backend.git
cd food-pricing-backend
npm install
```

**2. Create your `.env` file**

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and set at least `DATABASE_URL` (your Postgres password), `JWT_SECRET` (any random string of 16+ characters) and `ADMIN_PASSWORD` (8+ characters). See [Environment variables](#6-environment-variables).

> `.env` is in `.gitignore`. Never commit it.

**3. Create the database**

The default `DATABASE_URL` expects a database called `food_price_forecast`. Create it in pgAdmin (right-click *Databases* → *Create* → *Database*), or from a terminal:

```bash
psql -U postgres -c "CREATE DATABASE food_price_forecast;"
```

**4. Run the migrations** (creates the tables)

```bash
npm run db:migrate
```

**5. Seed the database** (loads prices, indicators, 25 commodities, the admin account, 12 months of back-tested forecasts, and mock visitor data)

```bash
npm run db:seed
```

> ⚠️ The seed script **deletes every row in every table first**, then re-creates demo data. Never run it against a database holding data you want to keep.

**6. Start the dev server**

```bash
npm run dev
```

You should see `API running on http://localhost:5000 (docs at /api/docs)`. Check it:

```bash
curl http://localhost:5000/api/v1/health
```

Then open the interactive docs at <http://localhost:5000/api/docs>.

The admin account is created from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in your `.env` at seed time. If you change them later, run `npm run db:seed` again.

---

## 6. Environment variables

Variables are checked when the server starts (see [src/config/env.ts](src/config/env.ts)). If any are wrong, the server prints what is wrong and exits. All values below are **placeholders**.

| Name | Required? | Default | Description | Example |
|---|---|---|---|---|
| `NODE_ENV` | Optional | `development` | `development`, `test` or `production`. In production, error messages are generic. | `production` |
| `PORT` | Optional | `5000` | Port the server listens on. | `5000` |
| `DATABASE_URL` | **Required** | none | PostgreSQL connection string. | `postgresql://postgres:YOUR_PASSWORD@localhost:5432/food_price_forecast` |
| `CORS_ORIGIN` | Optional | `http://localhost:3000` | The one frontend URL allowed to call the API. Must match exactly (no trailing slash). | `https://your-frontend.example.com` |
| `PUBLIC_URL` | Optional | `http://localhost:5000` | Public address of **this API**, used to build image URLs. Use the bare origin only, no `/api/v1`. | `https://your-api.onrender.com` |
| `JWT_SECRET` | **Required** | none | Secret used to sign admin tokens. At least 16 characters. | `a-long-random-string-here` |
| `JWT_EXPIRES_IN` | Optional | `1d` | How long an admin token lasts. | `1d` |
| `ADMIN_EMAIL` | **Required** | none | Email for the admin account created by the seed script. | `admin@example.com` |
| `ADMIN_PASSWORD` | **Required** | none | Password for that admin. At least 8 characters. | `ChangeMe-Please-123` |
| `ADMIN_NAME` | Optional | `Admin` | Display name for the admin. | `Site Admin` |
| `MODEL_PROVIDER` | Optional | `local` | `local` uses the built-in model; `remote` calls `MODEL_SERVER_URL`. | `local` |
| `MODEL_SERVER_URL` | Optional | `http://localhost:8000` | Base URL of the remote model server (only used if `MODEL_PROVIDER=remote`). | `http://localhost:8000` |
| `MODEL_TIMEOUT_MS` | Optional | `15000` | How long to wait for the remote model, in milliseconds. | `15000` |
| `DATA_SOURCE` | Optional | `mock` | `mock` reads the files in `ml-data/`. `nbs` is reserved and not connected yet. | `mock` |
| `LLM_API_KEY` | Optional | empty | Google Gemini API key. If empty, chat uses the rule-based responder. | `your-gemini-api-key` |
| `LLM_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name. | `gemini-2.5-flash` |
| `LLM_MAX_TOKENS` | Optional | `1024` | Maximum length of a chat reply. | `1024` |
| `ENABLE_CRON` | Optional | `true` | Set to `false` to turn off the scheduled jobs. | `true` |

> **Never put real passwords or API keys in this README, in `.env.example`, or in commits.**

---

## 7. npm scripts

| Script | Command it runs | What it does |
|---|---|---|
| `npm run dev` | `tsx watch src/server.ts` | Starts the server with auto-restart when files change. |
| `npm run build` | `prisma generate && tsc` | Generates the Prisma client, then compiles TypeScript into `dist/`. |
| `npm start` | `node dist/src/server.js` | Runs the compiled server (run `build` first). |
| `npm run data:generate` | `tsx scripts/build-ml-data.ts` | Rebuilds the price and indicator files in `ml-data/` from `ml-data/sources/`. |
| `npm run db:migrate` | `prisma migrate dev` | Applies migrations to your **development** database (and creates new ones if the schema changed). |
| `npm run db:seed` | `tsx prisma/seed.ts` | Wipes the database and fills it with demo data. |
| `npm run db:reset` | `prisma migrate reset --force` | Drops the database, re-applies all migrations and runs the seed command, **without asking**. |
| `npm run pipeline:run` | `tsx src/ml-services/pipeline/runMonthlyPipeline.ts` | Runs the full monthly pipeline once, by hand. |
| `npm test` | `vitest run` | Runs the API tests once. |
| `npm run lint` | `eslint .` | Checks the code for problems. |
| `npm run format` | `prettier --write .` | Reformats all files. |

---

## 8. API overview

- **Base path:** `/api/v1` (for example `http://localhost:5000/api/v1/health`)
- **Swagger UI:** `/api/docs` (for example <http://localhost:5000/api/docs>)
- **Static images:** `/images/commodities/<slug>.jpg` (note: **not** under `/api/v1`)
- **Detailed contract:** [API_CONTRACT.md](API_CONTRACT.md)
  > **TODO:** `API_CONTRACT.md` does not exist in this repository yet, so this link is broken. Until it is added, the Swagger docs at `/api/docs` are the most complete reference.

### Response format

Success:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 25 } }
```

(`meta` only appears on paginated lists.) Errors:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid", "details": [] } }
```

Error codes used in the code include `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED` and `INTERNAL_ERROR`.

### How auth works

| Type | Who it is for | How to use it |
|---|---|---|
| **Public** | Browsing forecasts | No header needed. |
| **Session ID** | Chat and analytics events | Send an `X-Session-Id` header containing any **UUID** your frontend generates once per visitor and stores. Without a valid UUID, these endpoints return `400`. |
| **Admin token (JWT)** | Everything under `/admin` except login | `POST /admin/auth/login` returns a `token`. Send it as `Authorization: Bearer <token>`. |

Any request that sends a valid `X-Session-Id` also records the visitor (the ID and browser user-agent, no IP address). Feedback works with or without the header.

### Endpoint groups

| Group | Endpoints | Access |
|---|---|---|
| **Meta** | `GET /health`, `GET /meta/data-status` | Public |
| **Dashboard** | `GET /dashboard/summary`, `GET /indicators/latest` | Public |
| **Commodities** | `GET /commodities` (filters: `search`, `category`, `direction`, `sort`, `page`, `limit`; `sort` is `name`, `price`, `change` for biggest predicted drop first, or `-change` for biggest rise first), `GET /commodities/categories`, `GET /commodities/:slug`, `GET /commodities/:slug/history?months=`, `GET /commodities/:slug/accuracy?months=`, `GET /commodities/:slug/related` | Public |
| **Analytics** | `POST /analytics/events` | Session ID |
| **Chat** | `POST /chat/conversations`, `POST /chat/conversations/:id/messages`, `GET /chat/conversations/:id` | Session ID |
| **Feedback** | `POST /feedback` | Public (session optional) |
| **Admin auth** | `POST /admin/auth/login`, `GET /admin/auth/me` | Login is public; `me` needs a token |
| **Admin** | `GET /admin/overview`, `GET /admin/analytics/usage`, `GET /admin/analytics/commodities`, `GET /admin/data/status`, `GET /admin/data/refresh-logs`, `POST /admin/data/refresh`, `GET /admin/accuracy`, `GET /admin/feedback`, `PATCH /admin/feedback/:id`, `GET /admin/commodities` | Admin token |

**Rate limits** (from [src/constants.ts](src/constants.ts)): 300 requests per 15 minutes per client overall; chat messages 20 per minute and 200 per day; feedback 5 per hour; analytics events 120 per minute; admin login 5 attempts per 15 minutes. Exceeding a limit returns `429` with code `RATE_LIMITED`.

### Example requests

Replace the port if you changed `PORT`.

**Health check**

```bash
curl http://localhost:5000/api/v1/health
```

```json
{ "success": true, "data": { "status": "ok", "db": "up", "uptime": 42, "time": "2026-11-05T10:00:00.000Z" } }
```

`status` is `"degraded"` and `db` is `"down"` if the database cannot be reached.

**List commodities (first page of 10, sorted by biggest predicted rise)**

```bash
curl "http://localhost:5000/api/v1/commodities?limit=10&sort=-change"
```

**One commodity with its forecast, factors and explanation**

```bash
curl http://localhost:5000/api/v1/commodities/rice-local
```

**Price history (last 12 months plus the forecast point)**

```bash
curl "http://localhost:5000/api/v1/commodities/rice-local/history?months=12"
```

**Record an analytics event** (needs `X-Session-Id`; returns `202`)

```bash
curl -X POST http://localhost:5000/api/v1/analytics/events \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" \
  -d '{"type":"COMMODITY_VIEW","path":"/commodities/rice-local","commoditySlug":"rice-local"}'
```

`type` can be `PAGE_VIEW`, `COMMODITY_VIEW` or `SEARCH`. Without a valid UUID in `X-Session-Id` you get a `400` error.

**Start a chat and send a message** (copy the conversation `id` from the first response)

```bash
curl -X POST http://localhost:5000/api/v1/chat/conversations \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" \
  -d '{"commoditySlug":"rice-local"}'

curl -X POST http://localhost:5000/api/v1/chat/conversations/CONVERSATION_ID/messages \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" \
  -d '{"message":"Why is the price changing?"}'
```

Messages are limited to 500 characters. Use the **same** session ID for the whole conversation; other sessions get a `404`.

**Send feedback** (message must be 10 to 1000 characters)

```bash
curl -X POST http://localhost:5000/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"GENERAL","message":"Great app, please add more foods."}'
```

**Admin login, then an admin request**

```bash
curl -X POST http://localhost:5000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YOUR_ADMIN_PASSWORD"}'

curl http://localhost:5000/api/v1/admin/overview \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Trigger a data refresh by hand** (`type` is `ALL`, `NBS_PRICES`, `MACRO_FEATURES`, `ACCURACY` or `PREDICTIONS`)

```bash
curl -X POST http://localhost:5000/api/v1/admin/data/refresh \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"type":"ALL"}'
```

---

## 9. Database

The schema is in [prisma/schema.prisma](prisma/schema.prisma). Main models:

| Model | What it stores |
|---|---|
| `Commodity` | One of the 25 foods: name, `slug`, category, unit, description, image path. |
| `PriceRecord` | One monthly price for one commodity (unique per commodity and month). |
| `Prediction` | A forecast for one commodity and one target month: current price, predicted price, bounds, percent change, direction, confidence, factors (JSON), explanation, model version and status (`ACTIVE` or `SUPERSEDED`). |
| `PredictionAccuracy` | The score for a prediction once the real price is known (one per prediction). |
| `MacroIndicator` | Monthly indicator values (exchange rate, diesel, petrol, inflation, rainfall, supply). |
| `DataRefreshLog` | A history of each pipeline step: type, status, trigger, records processed, errors. |
| `VisitorSession` | An anonymous visitor, identified by the UUID in `X-Session-Id`. |
| `AnalyticsEvent` | A page view, commodity view, search or chat-open event, linked to a session and optionally a commodity. |
| `ChatConversation` and `ChatMessage` | A chat about one commodity, and its messages (including whether the fallback responder was used). |
| `Feedback` | Visitor feedback with a category and a review status. |
| `Admin` | Admin account with a hashed password. |

### How they relate

```
Commodity ──< PriceRecord
    │
    ├──< Prediction ──── PredictionAccuracy   (one-to-one)
    │
    ├──< AnalyticsEvent >── VisitorSession
    ├──< ChatConversation >── VisitorSession
    │         └──< ChatMessage
    └──< Feedback >── VisitorSession (optional)

MacroIndicator, DataRefreshLog and Admin stand alone.
```

Deleting a commodity removes its prices, predictions, accuracy scores and chats. Deleting a visitor session removes its events and chats.

### Viewing the data

**Prisma Studio** (a browser-based table viewer that comes with Prisma):

```bash
npx prisma studio
```

**pgAdmin:** connect to your server (host, port and password from `DATABASE_URL`), then open *Databases → food_price_forecast → Schemas → public → Tables*, right-click a table and choose *View/Edit Data → All Rows*.

---

## 10. Testing, linting and formatting

```bash
npm test          # run the API tests
npm run lint      # check code with ESLint
npm run format    # fix formatting with Prettier
```

The tests in [tests/api.test.ts](tests/api.test.ts) call the real app with Supertest and **need a migrated and seeded database** (for example they expect 25 commodities and the seeded admin). Run `npm run db:migrate` and `npm run db:seed` first. The test setup turns off cron jobs and clears the Gemini key so the fallback chatbot is used. Test files run one at a time.

> The tests use whatever `DATABASE_URL` is in your `.env`, so point it at a development database, not production.

---

## 11. Deployment (Neon + Render)

This setup uses **Neon** for PostgreSQL and **Render** for the Node backend.

### 1. Create the database on Neon

1. Create a Neon project and copy its connection string. It looks like `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`.
2. From your own computer, point `DATABASE_URL` at it (in `.env`) and create the tables:

   ```bash
   npx prisma migrate deploy
   ```

   (`migrate deploy` is Prisma's command for applying existing migrations to a non-development database. `npm run db:migrate` is for local development.)
3. Seed it:

   ```bash
   npm run db:seed
   ```

   ⚠️ Seeding **wipes the database first**. Only do this on a new, empty database.

### 2. Create the web service on Render

| Setting | Value |
|---|---|
| Environment | Node |
| **Build command** | `npm install --include=dev && npm run build` |
| **Start command** | `npm start` |
| Health check path (optional) | `/api/v1/health` |

Add these environment variables in the Render dashboard:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Neon connection string |
| `CORS_ORIGIN` | Your frontend URL, e.g. `https://your-frontend.example.com` |
| `PUBLIC_URL` | Your Render URL, e.g. `https://your-api.onrender.com` |
| `JWT_SECRET` | A long random string (16+ characters) |
| `ADMIN_EMAIL` | The admin email (must be a valid email) |
| `ADMIN_PASSWORD` | A strong password (8+ characters) |

Optional: `LLM_API_KEY` (enables Gemini chat), `ADMIN_NAME`, `MODEL_PROVIDER`, `MODEL_SERVER_URL`, `ENABLE_CRON`, and the others in the [table above](#6-environment-variables). Render sets `PORT` for you.

### Gotchas

- **Build needs dev dependencies.** Use `npm install --include=dev`. TypeScript and all the `@types/*` packages are `devDependencies`, and `npm run build` needs them. With a plain production install, the build fails.
- **`PUBLIC_URL` must be the bare origin**, for example `https://your-api.onrender.com`, with **no `/api/v1`** and no trailing slash. Images are served from `/images`, not from under `/api/v1`. (The working copy of `src/config/env.ts` also trims any path to the origin, and rejects a value that is not a full URL.)
- **`CORS_ORIGIN` must match the frontend URL exactly**: same `https`, same host, no trailing slash. Only one origin is allowed.
- **Free Render instances sleep after inactivity.** The first request after a quiet period can take **up to about 50 seconds**. Cron jobs run inside the server process, so they cannot fire while the instance is asleep.
- **Seeding a remote database from far away is slow.** The seed makes many writes, so run it once and be patient. The code already allows long database transactions for this reason (see [P2028](#12-troubleshooting)).
- Start the server from the project root. It reads `public/images` and `ml-data/` relative to the working directory.

---

## 12. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| **Prisma error about `url` in the datasource** (for example "the datasource property `url` is no longer supported" or "url is missing") | This project uses **Prisma 7**: the connection URL lives in [prisma.config.ts](prisma.config.ts), not in `schema.prisma`, and the app connects through `@prisma/adapter-pg`. Errors like this usually mean a **different Prisma version** (such as Prisma 6) is being used, or a `url = env("DATABASE_URL")` line was added to the `datasource` block. Run `npm install`, use `npx prisma` (the local copy), check `npx prisma -v` says 7.x, and keep `schema.prisma` without a `url`. |
| **`Can't reach database server`, `ECONNREFUSED`, or authentication errors** | Wrong host, **port** or password in `DATABASE_URL`. PostgreSQL normally listens on `5432`, but some installs use another port (such as `5433`). Check the port in pgAdmin under *Server → Properties → Connection*, and make sure Postgres is running. Special characters in the password must be URL-encoded. |
| **`Invalid environment configuration` when starting** | A required variable is missing or invalid. The message lists each one (for example `JWT_SECRET` shorter than 16 characters, or `ADMIN_EMAIL` not an email). |
| **`P2028` transaction error / "Transaction API error: Transaction already closed"** | A database transaction ran longer than Prisma's default 5 seconds, which happens on slow remote databases. The prediction step saves in small batches with a 120-second timeout (see `DB_TRANSACTION_TIMEOUT_MS` in [src/constants.ts](src/constants.ts)). If you still see it, check your connection to the database, re-run the step, or lower `PREDICTION_SAVE_BATCH_SIZE`. |
| **CORS errors in the browser** | `CORS_ORIGIN` does not exactly match the frontend's origin (scheme, host, port, no trailing slash). Fix it and restart or redeploy. Also make sure the frontend sends only the allowed headers: `Content-Type`, `Authorization` and `X-Session-Id`. |
| **Images do not load** | Check `PUBLIC_URL`: it must be the API's public bare origin (no `/api/v1`). Image URLs are built as `PUBLIC_URL + /images/commodities/<slug>.jpg`. Open one in the browser to test. Also confirm the `public/images` folder was deployed, and that `CORS_ORIGIN` is right (the frontend reads `credits.json` from `/images`). |
| **`400 A valid X-Session-Id header is required`** | Chat and analytics need an `X-Session-Id` header containing a valid UUID. |
| **`429 RATE_LIMITED`** | You hit a rate limit (see [API overview](#8-api-overview)). Wait and retry. |
| **Admin login fails after changing `.env`** | The admin account is created by the seed script. Re-run `npm run db:seed` (which wipes the database) after changing `ADMIN_EMAIL` or `ADMIN_PASSWORD`. |
| **Pipeline fails with "The NBS data source is not connected yet"** | `DATA_SOURCE` is set to `nbs`. Set it to `mock`. |
| **Build fails on Render with missing type errors** | Use `npm install --include=dev && npm run build` as the build command. |
| **Chat replies look rule-based** | `LLM_API_KEY` is empty, or Gemini failed and the fallback answered. Replies include a `usedFallback` flag. |

---

## 13. Frontend, contributing and license

**Frontend repository:** `TODO: add link, e.g. https://github.com/<your-username>/<frontend-repo>`

### Contributing

1. Fork the repo and create a branch (`git checkout -b feature/my-change`).
2. Make your change, following the existing style: small functions, one folder per module, named constants in `src/constants.ts`.
3. Run `npm run lint`, `npm run format` and `npm test` before opening a pull request.
4. Never commit `.env` or real secrets.
5. Open a pull request describing what changed and why.

### Data credits

Commodity photos are credited in [public/images/commodities/CREDITS.md](public/images/commodities/CREDITS.md). Price data sources are listed in [ml-data/SOURCES.md](ml-data/SOURCES.md).

### License

`TODO: choose a license and add a LICENSE file.` (`package.json` currently says `ISC`, but there is no `LICENSE` file in the repository.)
