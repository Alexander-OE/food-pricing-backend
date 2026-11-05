# FoodCast: Lagos Food Price Forecast (`food-pricing-backend`)

> This README covers the **whole FoodCast product** (website, API, database and forecasting), not only this backend folder. The website lives in a separate repository, [`food-pricing-frontend`](https://github.com/Alexander-OE/food-pricing-frontend) (the local folder is often named `food-price-frontend`).

> **Heads up:** the price data in this repo is a snapshot of Lagos prices (January 2018 to May 2026) built mostly from National Bureau of Statistics (NBS) figures, with some months estimated. See [ml-data/SOURCES.md](ml-data/SOURCES.md) for exactly what is real and what is estimated.

---

## Table of contents

1. [What FoodCast is](#1-what-foodcast-is)
2. [How the whole system fits together](#2-how-the-whole-system-fits-together)
3. [Features](#3-features)
4. [Tech stack](#4-tech-stack)
5. [Frontend overview](#5-frontend-overview)
6. [Backend overview](#6-backend-overview)
7. [Getting started (run both projects locally)](#7-getting-started-run-both-projects-locally)
8. [Environment variables](#8-environment-variables)
9. [Scripts](#9-scripts)
10. [Deployment (Neon, Render, Vercel)](#10-deployment-neon-render-vercel)
11. [How the forecasting works, in depth](#11-how-the-forecasting-works-in-depth)
12. [API reference and examples](#12-api-reference-and-examples)
13. [Database](#13-database)
14. [Testing, linting and formatting](#14-testing-linting-and-formatting)
15. [Troubleshooting](#15-troubleshooting)
16. [Contributing, credits and license](#16-contributing-credits-and-license)

---

## 1. What FoodCast is

FoodCast tells people in Lagos, Nigeria **where food prices are heading next month**. It covers **25 common foods** (rice, yam, tomato, garri, eggs, palm oil and more). For each food it shows today's price, a predicted price for next month, a likely price range, how confident the forecast is, whether the price is **rising, falling or steady**, and a plain-English explanation of why.

It is built for **shoppers, market traders and anyone budgeting for food**. Food prices in Nigeria can jump from one month to the next because of the dollar rate, fuel costs, the season and supply. That makes household budgeting hard. FoodCast gives you an early, easy-to-read warning, so you can decide what to buy now, what to wait on, and how much to set aside. It also checks its own work: once the real price is known, it scores the earlier forecast and shows you how close it was.

---

## 2. How the whole system fits together

```mermaid
flowchart LR
    U["Shopper or admin<br/>(web browser)"] --> FE["Frontend<br/>Next.js on Vercel"]
    FE -- "HTTPS requests to /api/v1" --> BE["Backend API<br/>Express on Render"]
    BE -- "Prisma" --> DB[("PostgreSQL<br/>on Neon")]
    BE -- "chat questions" --> LLM["Google Gemini<br/>(LLM)"]
    CRON["Monthly forecasting pipeline<br/>(node-cron inside the backend)"] -- "reads data files, writes forecasts" --> DB
    BE --- CRON
    ML["ml-data/ files<br/>(prices and indicators)"] --> CRON
```

How to read the diagram:

| Part | Where it runs | What it does |
|---|---|---|
| **Frontend** | Vercel | The website people see. It holds no data of its own. It asks the backend for everything. |
| **Backend API** | Render | Receives requests, checks them, reads and writes the database, and answers in a standard JSON format. |
| **PostgreSQL** | Neon | Stores commodities, prices, forecasts, accuracy scores, visitors, chats, feedback and the admin account. |
| **Gemini LLM** | Google | Writes the answers in the per-commodity chat. If no API key is set, or Gemini fails, the backend uses a built-in rule-based answerer instead, so chat always replies. |
| **Monthly pipeline** | Inside the backend process | On the 16th of each month at 07:00 (Lagos time): load new data, score old forecasts, make new forecasts. A lighter indicator refresh runs every day at 06:00. Admins can also trigger it by hand. |

---

## 3. Features

### What a shopper can do (public site)

| Feature | What you see |
|---|---|
| **Browse prices** | Every food in a grid, with search, category, direction and sort filters, and paging. |
| **Next-month forecasts** | A predicted price, a likely price range (an 80% range) and a **confidence** score for each food. |
| **Rising or falling indicators** | Each food is marked **Rising ↑** (red), **Falling ↓** (green) or **Steady →** (grey). A forecast change within ±2% counts as steady. |
| **Commodity detail pages** | One page per food with price now, the forecast, and the reasons behind it. |
| **What moves prices** | A list of factors (trend, season, diesel, exchange rate, supply), each with its direction, size and a plain sentence. |
| **Price history** | A chart of past monthly prices plus the forecast point, with a choice of time range. |
| **Forecast accuracy** | A chart and table of what we predicted against the real price for past months. |
| **Market overview** | The home page shows how many foods are rising, falling or steady, the biggest expected rises, and market drivers (dollar rate, diesel, petrol, food inflation). |
| **AI chat explanations** | On each commodity page you can ask the FoodCast bot why a price is moving. Answers come from Google Gemini, or from a rule-based fallback using the real forecast data. |
| **How it works page** | A short explanation, a "how to read a forecast" guide, shopping tips, live data status and service health. |
| **Feedback** | A form to send a message (general, bug, prediction accuracy or feature request). |
| **Dark mode** | A light and dark theme toggle that remembers your choice. |

### What an admin can do (`/admin`, sign-in required)

| Feature | What you see |
|---|---|
| **Admin access** | Email and password sign-in. The admin site is not linked from the public site; you open `/admin` by typing it. |
| **Overview** | Headline cards (visitors, views, chats, feedback, accuracy) and the latest data refreshes. |
| **Usage analytics** | A daily usage chart and the most viewed commodities. |
| **Data health** | How fresh each data step is, a button to run a refresh by hand, and the refresh history. |
| **Forecast accuracy** | Forecast error and direction hit rate over time, plus the best and worst foods. |
| **Feedback inbox** | Read feedback and mark each message `NEW`, `REVIEWED` or `RESOLVED`. |
| **Commodities** | A list of all commodities. |

### Behind the scenes (backend)

| Feature | What it does |
|---|---|
| **Confidence scores** | A number from 0.55 to 0.92 for every forecast. A tighter price range means higher confidence. |
| **Accuracy tracking** | Past forecasts are scored against the real price once it is known (percent error and whether the direction was right). |
| **Market indicators** | Latest USD/NGN exchange rate, diesel, petrol and food inflation, with the monthly change. |
| **Usage analytics** | Anonymous page views, commodity views and searches, recorded against a visitor-chosen session ID (no IP addresses stored). |
| **Monthly cron pipeline** | Loads new data, scores old forecasts and makes new ones, on a schedule. |
| **Rate limiting** | Separate limits for general traffic, chat, feedback, analytics and admin login. |
| **Swagger docs** | Interactive API docs served by the app itself at `/api/docs`. |

---

## 4. Tech stack

| Area | Frontend (`food-pricing-frontend`) | Backend (`food-pricing-backend`) |
|---|---|---|
| Language | TypeScript | TypeScript |
| Framework | Next.js 16 (App Router) with React 19 | Express 5 on Node.js |
| Styling | Tailwind CSS 4 (via PostCSS) | not applicable |
| Data fetching | Axios with small custom hooks (`useState` and `useEffect`, no React Query) | not applicable |
| Charts | Recharts | not applicable |
| Fonts | Bricolage Grotesque and Plus Jakarta Sans (`next/font`) | not applicable |
| Database access | not applicable | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Database | not applicable | PostgreSQL (Neon in production) |
| Validation | not applicable | Zod |
| Auth | Admin token kept in `localStorage` | JSON Web Tokens (`jsonwebtoken`) and `bcryptjs` password hashes |
| LLM (chat) | not applicable | Google Gemini via `@google/generative-ai` (default model `gemini-2.5-flash`) |
| Forecasting | not applicable | A **local, in-process model** (default), with an **optional remote model server** over HTTP |
| Scheduling | not applicable | `node-cron` |
| Security and ops | not applicable | `helmet`, `cors`, `compression`, `express-rate-limit`, `pino` logging |
| API docs | not applicable | `swagger-ui-express` |
| Tests | none yet | Vitest and Supertest |
| Code quality | ESLint | ESLint and Prettier |
| Hosting | Vercel | Render (app) and Neon (database) |

---

## 5. Frontend overview

The frontend is a Next.js app with a **public site** and a separate **admin site**. It shows only data from this API; nothing is hardcoded. Repository: <https://github.com/Alexander-OE/food-pricing-frontend>.

### Pages and routes

**Public site** (the navbar links only to these)

| Route | What it shows |
|---|---|
| `/` | Welcome banner, market overview (rising, falling and steady counts), market drivers, biggest expected rises, category links |
| `/commodities` | Every commodity, with search, category, direction and sort filters, and paging |
| `/commodities/[slug]` | Price now, next month's forecast with range and confidence, reasons, price history chart, forecast accuracy, chat with the FoodCast bot, related commodities |
| `/how-it-works` | How a forecast is made, how to read one, shopping tips, live data status and service health |
| `/feedback` | Feedback form |

**Admin site** (not linked from the public site)

| Route | What it shows |
|---|---|
| `/admin/login` | Email and password sign-in |
| `/admin` | Headline cards and the latest data refreshes |
| `/admin/analytics` | Daily usage chart and most viewed commodities |
| `/admin/data` | Freshness of each data step, run a refresh (asks to confirm), refresh history |
| `/admin/accuracy` | Forecast error and direction hit rate over time, best and worst commodities |
| `/admin/feedback` | Feedback inbox; change a message's status (asks to confirm) |
| `/admin/commodities` | List of all commodities |

### Main components

All of these are under `src/components/` in the frontend.

| Folder | What is in it |
|---|---|
| `ui/` | Reusable pieces: buttons, cards, skeleton loaders, error and empty states (`AsyncView`), dialogs, badges, pagination, the dark mode toggle |
| `commodity/` | Commodity tiles and grid, category chips, the forecast panel, the factor list ("what moves prices"), the accuracy table |
| `charts/` | Recharts charts: price history, line trends, rankings |
| `home/` | Home page hero, market pulse and indicator strip |
| `info/` | The "how to read a forecast" guide, shopping tips, health card |
| `chat/` | The chat box on commodity pages |
| `layout/` | Navbar, footer, and the invisible page view tracker |
| `admin/` | Admin sidebar and badges |

### How it calls the API

```
page  ->  hook (src/lib/hooks)  ->  API function (src/lib/api)  ->  one Axios client  ->  backend /api/v1
```

- `src/lib/api/client.ts` holds the **one Axios instance**. Its base URL comes from `NEXT_PUBLIC_API_URL`. Before each request it adds a header:
  - visitor requests get `X-Session-Id`, a random UUID created once per browser and saved in `localStorage` (the backend needs it for chat and analytics);
  - admin requests (anything under `/admin`) get `Authorization: Bearer <token>`.
- If an admin request comes back `401`, the token is cleared and the browser goes to `/admin/login`.
- `src/lib/api/*.ts` has one function per endpoint. `src/lib/hooks/*.ts` has one small hook per data need, each returning `{ data, loading, error, refetch }`.
- Every data section shows a loading skeleton, a friendly empty message, or an error with a "Try again" button.
- The admin token is stored in `localStorage`. The admin layout redirects to the login page if there is no token or the backend rejects it.
- Page views, commodity views and searches are reported to `POST /analytics/events`.
- Commodity photos are loaded from the backend at `/images/commodities/...`. The frontend works out the backend's origin by dropping the path from `NEXT_PUBLIC_API_URL`.

### Which environment variable sets the API URL

`NEXT_PUBLIC_API_URL`. It must include `/api/v1`, for example `http://localhost:5000/api/v1`. See [Environment variables](#8-environment-variables).

### Run the frontend locally

You need Node.js 20.9 or newer (Next.js 16 requires it) and the backend running (see [Getting started](#7-getting-started-run-both-projects-locally)).

```bash
git clone https://github.com/Alexander-OE/food-pricing-frontend.git
cd food-pricing-frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1" > .env.local
npm run dev
```

On Windows PowerShell, create the env file with `Set-Content .env.local "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1"` instead of `echo`. Then open <http://localhost:3000>.

---

## 6. Backend overview

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

### How forecasting works (the short version)

1. **Collect.** Monthly Lagos prices for each food, plus indicators such as the dollar rate and diesel price, are loaded from files in `ml-data/`.
2. **Predict.** For each food the model looks at the last few years of prices. It adds up the recent trend, the usual seasonal pattern, and the effect of diesel, the exchange rate and supply. That gives a predicted price and a likely range.
3. **Explain.** The backend works out the percent change, labels it up, down or steady, and writes a plain-English reason from the biggest factors.
4. **Check.** When the real price arrives, the earlier forecast is scored. These scores power the accuracy charts.

This runs automatically on the 16th of each month. The full detail is in [section 11](#11-how-the-forecasting-works-in-depth).

### API groups under `/api/v1`

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

Interactive docs: `/api/docs` (Swagger). Photos are served at `/images/commodities/<slug>.jpg`, which is **not** under `/api/v1`.

### How auth works

| Type | Who it is for | How to use it |
|---|---|---|
| **Public** | Browsing forecasts | No header needed. |
| **Session ID** | Chat and analytics events | Send an `X-Session-Id` header containing any **UUID** your frontend generates once per visitor and stores. Without a valid UUID, these endpoints return `400`. |
| **Admin token (JWT)** | Everything under `/admin` except login | `POST /admin/auth/login` returns a `token`. Send it as `Authorization: Bearer <token>`. |

Any request that sends a valid `X-Session-Id` also records the visitor (the ID and browser user-agent, no IP address). Feedback works with or without the header.

The admin account is created by the seed script from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME`. Passwords are stored as bcrypt hashes. There is one login route and no sign-up.

---

## 7. Getting started (run both projects locally)

Do the steps **in this order**: database, backend, then frontend. The frontend needs a running backend to show anything.

### Prerequisites

- **Node.js** and **npm**. Use **Node 20.19 or newer**. Prisma 7 and the TypeScript tooling need a recent version, and Next.js 16 needs at least 20.9. *TODO: neither `package.json` has an `engines` field, so no exact version is enforced.*
- **PostgreSQL** installed and running (or a free [Neon](https://neon.tech) database).
- **Git**.
- *Optional:* a Google Gemini API key for AI chat. Without it, chat still works using the rule-based responder.

### Part A: the backend

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

Open `.env` and set at least `DATABASE_URL` (your Postgres password), `JWT_SECRET` (any random string of 16+ characters) and `ADMIN_PASSWORD` (8+ characters). The sample admin email and password in `.env.example` are for local use only, so change them before deploying. See [Environment variables](#8-environment-variables).

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

Then open the interactive docs at <http://localhost:5000/api/docs>. Leave this terminal running.

The admin account comes from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in your `.env` at seed time. If you change them later, run `npm run db:seed` again.

### Part B: the frontend

Open a **second terminal**.

**7. Clone and install**

```bash
git clone https://github.com/Alexander-OE/food-pricing-frontend.git
cd food-pricing-frontend
npm install
```

**8. Point it at the backend**

The frontend reads one setting, `NEXT_PUBLIC_API_URL`. Put it in a file called `.env.local`:

```bash
# macOS / Linux / Git Bash
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1" > .env.local

# Windows PowerShell
Set-Content .env.local "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1"
```

(The frontend repo's `.gitignore` ignores every `.env*` file, so a fresh clone has no `.env.example`. Creating `.env.local` by hand is the reliable way.)

**9. Start the frontend**

```bash
npm run dev
```

**10. Open the site**

- Public site: <http://localhost:3000>
- Admin site: <http://localhost:3000/admin> (sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the backend `.env`)

The backend already allows requests from `http://localhost:3000` (that is the default `CORS_ORIGIN`). If you run the frontend on another port, change `CORS_ORIGIN` in the backend `.env` and restart the backend.

---

## 8. Environment variables

All values below are **placeholders**. Never put real passwords or API keys in this README, in `.env.example`, or in commits.

### Backend (`food-pricing-backend`)

Variables are checked when the server starts (see [src/config/env.ts](src/config/env.ts)). If any are wrong, the server prints what is wrong and exits.

| Name | Required? | Default | Description | Example |
|---|---|---|---|---|
| `NODE_ENV` | Optional | `development` | `development`, `test` or `production`. In production, error messages are generic. | `production` |
| `PORT` | Optional | `5000` | Port the server listens on. Render sets this for you. | `5000` |
| `DATABASE_URL` | **Required** | none | PostgreSQL connection string. | `postgresql://postgres:YOUR_PASSWORD@localhost:5432/food_price_forecast` |
| `CORS_ORIGIN` | Optional (set it in production) | `http://localhost:3000` | The one frontend URL allowed to call the API. Must match exactly, with no trailing slash. | `https://your-frontend.vercel.app` |
| `PUBLIC_URL` | Optional (set it in production) | `http://localhost:5000` | Public address of **this API**, used to build image URLs. Use the bare origin only, no `/api/v1`. | `https://your-api.onrender.com` |
| `JWT_SECRET` | **Required** | none | Secret used to sign admin tokens. At least 16 characters. | `a-long-random-string-here` |
| `JWT_EXPIRES_IN` | Optional | `1d` | How long an admin token lasts. | `1d` |
| `ADMIN_EMAIL` | **Required** | none | Email for the admin account created by the seed script. | `admin@example.com` |
| `ADMIN_PASSWORD` | **Required** | none | Password for that admin. At least 8 characters. | `your-strong-password` |
| `ADMIN_NAME` | Optional | `Admin` | Display name for the admin. | `Site Admin` |
| `MODEL_PROVIDER` | Optional | `local` | `local` uses the built-in model; `remote` calls `MODEL_SERVER_URL`. | `local` |
| `MODEL_SERVER_URL` | Optional | `http://localhost:8000` | Base URL of the remote model server (only used if `MODEL_PROVIDER=remote`). | `http://localhost:8000` |
| `MODEL_TIMEOUT_MS` | Optional | `15000` | How long to wait for the remote model, in milliseconds. | `15000` |
| `DATA_SOURCE` | Optional | `mock` | `mock` reads the files in `ml-data/`. `nbs` is reserved and not connected yet. | `mock` |
| `LLM_API_KEY` | Optional | empty | Google Gemini API key. If empty, chat uses the rule-based responder. | `your-gemini-api-key` |
| `LLM_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name. | `gemini-2.5-flash` |
| `LLM_MAX_TOKENS` | Optional | `1024` | Maximum length of a chat reply. | `1024` |
| `ENABLE_CRON` | Optional | `true` | Set to `false` to turn off the scheduled jobs. | `true` |

### Frontend (`food-pricing-frontend`)

| Name | Required? | Default | Description | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Required** | none | Address of the backend API, **including `/api/v1`**. The frontend also uses it to find the photos, by dropping the path. Local file: `.env.local`. On Vercel: Project Settings → Environment Variables. | `https://your-api.onrender.com/api/v1` |

Any variable starting with `NEXT_PUBLIC_` is baked into the frontend's JavaScript at **build time** and is visible to anyone using the site. Never put a secret in one.

---

## 9. Scripts

### Backend (`food-pricing-backend`)

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

### Frontend (`food-pricing-frontend`)

| Script | Command it runs | What it does |
|---|---|---|
| `npm run dev` | `next dev` | Starts the site at <http://localhost:3000> with live reload. |
| `npm run build` | `next build` | Makes the optimised production build. |
| `npm start` | `next start` | Serves the production build (run `build` first). |
| `npm run lint` | `eslint` | Checks the code for problems. |

---

## 10. Deployment (Neon, Render, Vercel)

Deploy in this order: **Neon (database) → Render (backend) → Vercel (frontend)**. The backend needs the database address, and the frontend needs the backend address. After Vercel gives you the frontend URL, you go back to Render once to set `CORS_ORIGIN`.

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

   The seed uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the `.env` on your computer to create the admin account, so set the values you want to use in production first.

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
| `CORS_ORIGIN` | Your production frontend URL, e.g. `https://your-frontend.vercel.app` |
| `PUBLIC_URL` | Your Render URL, e.g. `https://your-api.onrender.com` |
| `JWT_SECRET` | A long random string (16+ characters) |
| `ADMIN_EMAIL` | The admin email (must be a valid email) |
| `ADMIN_PASSWORD` | A strong password (8+ characters) |

Optional: `LLM_API_KEY` (enables Gemini chat), `ADMIN_NAME`, `MODEL_PROVIDER`, `MODEL_SERVER_URL`, `ENABLE_CRON`, and the others in the [table above](#8-environment-variables). Render sets `PORT` for you.

When it is live, check `https://your-api.onrender.com/api/v1/health`.

### 3. Deploy the frontend on Vercel

1. Import the `food-pricing-frontend` repository into Vercel. Vercel detects Next.js by itself.
2. Use these settings (they are the defaults for Next.js):

   | Setting | Value |
   |---|---|
   | Framework preset | Next.js |
   | Install command | `npm install` |
   | **Build command** | `npm run build` |
   | Start | Handled by Vercel (locally the equivalent is `npm start`) |
   | Node.js version | 20.9 or newer |

3. Add one environment variable (Project Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com/api/v1` |

4. Deploy, then copy the production URL (for example `https://your-frontend.vercel.app`).
5. Go back to Render, set `CORS_ORIGIN` to that exact URL, and let the service redeploy.

### Gotchas

- **Render build needs dev dependencies.** Use `npm install --include=dev`. TypeScript and all the `@types/*` packages are `devDependencies`, and `npm run build` needs them. With a plain production install, the build fails.
- **`PUBLIC_URL` is the bare origin**, for example `https://your-api.onrender.com`, with **no `/api/v1`** and no trailing slash. Images are served from `/images`, not from under `/api/v1`. (`src/config/env.ts` also trims any path down to the origin, and rejects a value that is not a full URL.)
- **`CORS_ORIGIN` must exactly match the production frontend URL**: same `https`, same host, no trailing slash. Only one origin is allowed. Vercel also makes preview URLs for each branch; those are different origins and will be blocked.
- **Free Render instances sleep after inactivity.** The first request after a quiet period can take **up to about 50 seconds**, so the site may look broken for a moment. Cron jobs run inside the server process, so they cannot fire while the instance is asleep.
- **The frontend only picks up env changes after a new build.** `NEXT_PUBLIC_API_URL` is baked in when Next.js builds the site. After you change it in Vercel, **redeploy** (Deployments → Redeploy). Editing the value alone changes nothing on the live site. The same applies locally: restart `npm run dev` after editing `.env.local`.
- **`NEXT_PUBLIC_API_URL` includes `/api/v1`**, unlike `PUBLIC_URL`. Mixing these two up is the most common setup mistake.
- **Seeding a remote database from far away is slow.** The seed makes many writes, so run it once and be patient. The code already allows long database transactions for this reason (see [P2028](#15-troubleshooting)).
- Start the server from the project root. It reads `public/images` and `ml-data/` relative to the working directory.

---

## 11. How the forecasting works, in depth

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

You can also start it by hand with `npm run pipeline:run`, or from the admin site's **Data health** page (`POST /admin/data/refresh`).

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

> **Note:** with `DATA_SOURCE=mock`, steps 1 and 2 only read the files already in `ml-data/`. They do not download anything. New months appear only after the files are updated and the pipeline runs.

### Remote model and the fallback

Set `MODEL_PROVIDER=remote` and `MODEL_SERVER_URL` to use your own model server. The API sends `POST {MODEL_SERVER_URL}/predict` with `{ "inputs": [...] }` and expects `{ "predictions": [...] }` back (the exact shapes are in [src/ml-services/model/ModelProvider.ts](src/ml-services/model/ModelProvider.ts) and [RemoteModelClient.ts](src/ml-services/model/RemoteModelClient.ts)). The response is checked with Zod, and the request retries once on a network error or timeout.

**If the remote server is unreachable, times out, returns an error or sends a badly shaped response, the API falls back to the local model**, so the site never shows empty forecasts. The failure is saved as a `FAILED` row with trigger `model-fallback` in `DataRefreshLog`, so admins can see why.

> **TODO:** a comment in `RemoteModelClient.ts` says the request/response format is still to be confirmed with the model's author.

---

## 12. API reference and examples

- **Base path:** `/api/v1` (for example `http://localhost:5000/api/v1/health`)
- **Swagger UI:** `/api/docs` (for example <http://localhost:5000/api/docs>)
- **Static images:** `/images/commodities/<slug>.jpg` (note: **not** under `/api/v1`)
- **Detailed contract:** `API_CONTRACT.md`. It sits in the workspace folder next to both projects (one level above this one), not inside this repository, so it has no link here. A longer design brief, `food-pricing-build-spec.md`, is kept in the same place. The Swagger docs at `/api/docs` always match the running code.

The endpoint list is in [API groups under `/api/v1`](#api-groups-under-apiv1) and the auth rules are in [How auth works](#how-auth-works).

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

### Rate limits

From [src/constants.ts](src/constants.ts): 300 requests per 15 minutes per client overall; chat messages 20 per minute and 200 per day; feedback 5 per hour; analytics events 120 per minute; admin login 5 attempts per 15 minutes. Exceeding a limit returns `429` with code `RATE_LIMITED`.

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

**Send feedback** (message must be 10 to 1000 characters; `category` is `GENERAL`, `BUG`, `PREDICTION_ACCURACY` or `FEATURE_REQUEST`)

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

## 13. Database

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

## 14. Testing, linting and formatting

```bash
npm test          # run the API tests
npm run lint      # check code with ESLint
npm run format    # fix formatting with Prettier
```

The tests in [tests/api.test.ts](tests/api.test.ts) call the real app with Supertest and **need a migrated and seeded database** (for example they expect 25 commodities and the seeded admin). Run `npm run db:migrate` and `npm run db:seed` first. The test setup turns off cron jobs and clears the Gemini key so the fallback chatbot is used. Test files run one at a time.

> The tests use whatever `DATABASE_URL` is in your `.env`, so point it at a development database, not production.

The frontend has no automated tests yet. Use `npm run lint` there.

---

## 15. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| **Prisma error about `url` in the datasource** (for example "the datasource property `url` is no longer supported" or "url is missing") | This project uses **Prisma 7**: the connection URL lives in [prisma.config.ts](prisma.config.ts), not in `schema.prisma`, and the app connects through `@prisma/adapter-pg`. Errors like this usually mean a **different Prisma version** (such as Prisma 6) is being used, or a `url = env("DATABASE_URL")` line was added to the `datasource` block. Run `npm install`, use `npx prisma` (the local copy), check `npx prisma -v` says 7.x, and keep `schema.prisma` without a `url`. |
| **`Can't reach database server`, `ECONNREFUSED`, or authentication errors** | Wrong host, **port** or password in `DATABASE_URL`. PostgreSQL normally listens on `5432`, but some installs use another port (such as `5433`). Check the port in pgAdmin under *Server → Properties → Connection*, and make sure Postgres is running. Special characters in the password must be URL-encoded. |
| **`Invalid environment configuration` when starting** | A required variable is missing or invalid. The message lists each one (for example `JWT_SECRET` shorter than 16 characters, or `ADMIN_EMAIL` not an email). |
| **`P2028` transaction error / "Transaction API error: Transaction already closed"** | A database transaction ran longer than Prisma's default 5 seconds, which happens on slow remote databases. The prediction step saves in small batches with a 120-second timeout (see `DB_TRANSACTION_TIMEOUT_MS` in [src/constants.ts](src/constants.ts)). If you still see it, check your connection to the database, re-run the step, or lower `PREDICTION_SAVE_BATCH_SIZE`. |
| **CORS errors in the browser** | `CORS_ORIGIN` does not exactly match the frontend's origin (scheme, host, port, no trailing slash). Fix it and restart or redeploy the backend. Also make sure the frontend sends only the allowed headers: `Content-Type`, `Authorization` and `X-Session-Id`. |
| **The deployed site shows no data, or requests go to the wrong address** | `NEXT_PUBLIC_API_URL` is missing, wrong, or was changed without a redeploy. It must end in `/api/v1`. Fix it in Vercel and **redeploy**. |
| **The first page load takes up to a minute** | The free Render instance was asleep. Wait for it to wake up; later requests are fast. |
| **Images do not load** | Check `PUBLIC_URL`: it must be the API's public bare origin (no `/api/v1`). Image URLs are built as `PUBLIC_URL + /images/commodities/<slug>.jpg`. Open one in the browser to test. Also confirm the `public/images` folder was deployed, and that `CORS_ORIGIN` is right (the frontend reads `credits.json` from `/images`). |
| **`400 A valid X-Session-Id header is required`** | Chat and analytics need an `X-Session-Id` header containing a valid UUID. |
| **`429 RATE_LIMITED`** | You hit a rate limit (see [Rate limits](#rate-limits)). Wait and retry. |
| **Admin login fails after changing `.env`** | The admin account is created by the seed script. Re-run `npm run db:seed` (which wipes the database) after changing `ADMIN_EMAIL` or `ADMIN_PASSWORD`. |
| **Pipeline fails with "The NBS data source is not connected yet"** | `DATA_SOURCE` is set to `nbs`. Set it to `mock`. |
| **Build fails on Render with missing type errors** | Use `npm install --include=dev && npm run build` as the build command. |
| **Chat replies look rule-based** | `LLM_API_KEY` is empty, or Gemini failed and the fallback answered. Replies include a `usedFallback` flag. |

---

## 16. Contributing, credits and license

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
