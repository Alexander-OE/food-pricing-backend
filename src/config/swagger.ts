// Swagger (OpenAPI) description of every endpoint, served at /api/docs.

type Method = 'get' | 'post' | 'patch';
type Access = 'public' | 'session' | 'admin';

interface QueryParam {
  name: string;
  enum?: string[];
  type?: 'string' | 'integer';
  default?: string | number;
  description?: string;
}

interface EndpointDoc {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  /** public: no auth; session: X-Session-Id header; admin: Bearer token. */
  access?: Access;
  query?: QueryParam[];
  /** Example body, pre-filled in Swagger UI. */
  body?: Record<string, unknown>;
  /** Success status code (default 200). */
  status?: number;
}

const CATEGORIES = [
  'GRAINS',
  'LEGUMES',
  'TUBERS',
  'VEGETABLES',
  'FRUITS',
  'PROTEIN',
  'OILS',
  'OTHERS',
];
const DIRECTIONS = ['UP', 'DOWN', 'STABLE'];
const REFRESH_TYPES = ['NBS_PRICES', 'MACRO_FEATURES', 'PREDICTIONS', 'ACCURACY'];
const FEEDBACK_CATEGORIES = ['GENERAL', 'BUG', 'PREDICTION_ACCURACY', 'FEATURE_REQUEST'];
const FEEDBACK_STATUSES = ['NEW', 'REVIEWED', 'RESOLVED'];

const page: QueryParam = { name: 'page', type: 'integer', default: 1 };
const limit: QueryParam = { name: 'limit', type: 'integer', default: 20 };
const months: QueryParam = { name: 'months', type: 'integer', description: 'Number of months' };
const range: QueryParam = { name: 'range', enum: ['7d', '30d', '90d'], default: '30d' };

const ENDPOINTS: EndpointDoc[] = [
  // Meta
  { method: 'get', path: '/health', tag: 'Meta', summary: 'Service and database health' },
  {
    method: 'get',
    path: '/meta/data-status',
    tag: 'Meta',
    summary: 'Latest data month, last refresh, next refresh, model version',
  },

  // Dashboard
  {
    method: 'get',
    path: '/dashboard/summary',
    tag: 'Dashboard',
    summary: 'Market pulse across all commodities',
  },
  {
    method: 'get',
    path: '/indicators/latest',
    tag: 'Dashboard',
    summary: 'Latest FX, diesel, petrol and food inflation with monthly change',
  },

  // Commodities
  {
    method: 'get',
    path: '/commodities',
    tag: 'Commodities',
    summary: 'List commodities',
    query: [
      { name: 'search' },
      { name: 'category', enum: CATEGORIES },
      { name: 'direction', enum: DIRECTIONS },
      { name: 'sort', enum: ['name', 'price', 'change', '-change'], default: 'name' },
      page,
      limit,
    ],
  },
  {
    method: 'get',
    path: '/commodities/categories',
    tag: 'Commodities',
    summary: 'Categories with counts',
  },
  {
    method: 'get',
    path: '/commodities/{slug}',
    tag: 'Commodities',
    summary: 'Full commodity detail with prediction (try slug: rice-local)',
  },
  {
    method: 'get',
    path: '/commodities/{slug}/history',
    tag: 'Commodities',
    summary: 'Price history plus forecast point with bounds',
    query: [months],
  },
  {
    method: 'get',
    path: '/commodities/{slug}/accuracy',
    tag: 'Commodities',
    summary: 'Predicted vs actual per month',
    query: [months],
  },
  {
    method: 'get',
    path: '/commodities/{slug}/related',
    tag: 'Commodities',
    summary: 'Related commodities',
  },

  // Analytics, chat and feedback (visitor-facing)
  {
    method: 'post',
    path: '/analytics/events',
    tag: 'Analytics',
    summary: 'Record a page view, commodity view or search',
    access: 'session',
    status: 202,
    body: { type: 'COMMODITY_VIEW', path: '/commodities/rice-local', commoditySlug: 'rice-local' },
  },
  {
    method: 'post',
    path: '/chat/conversations',
    tag: 'Chat',
    summary: 'Start a conversation about a commodity (copy the returned id for the next calls)',
    access: 'session',
    status: 201,
    body: { commoditySlug: 'rice-local' },
  },
  {
    method: 'post',
    path: '/chat/conversations/{id}/messages',
    tag: 'Chat',
    summary: 'Send a message and get the reply',
    access: 'session',
    body: { message: 'Will the price of rice go up next month?' },
  },
  {
    method: 'get',
    path: '/chat/conversations/{id}',
    tag: 'Chat',
    summary: 'Read a conversation (own session only)',
    access: 'session',
  },
  {
    method: 'post',
    path: '/feedback',
    tag: 'Feedback',
    summary: 'Submit feedback',
    status: 201,
    body: {
      name: 'Ada',
      email: 'ada@example.com',
      category: 'GENERAL',
      message: 'Great app, the forecasts are really helpful.',
      commoditySlug: 'rice-local',
    },
  },

  // Admin
  {
    method: 'post',
    path: '/admin/auth/login',
    tag: 'Admin',
    summary: 'Admin login, returns a JWT. Paste it into "Authorize" to unlock the routes below',
    body: { email: 'admin@foodforecast.ng', password: 'Admin@12345' },
  },
  {
    method: 'get',
    path: '/admin/auth/me',
    tag: 'Admin',
    summary: 'Current admin',
    access: 'admin',
  },
  { method: 'get', path: '/admin/overview', tag: 'Admin', summary: 'KPI cards', access: 'admin' },
  {
    method: 'get',
    path: '/admin/analytics/usage',
    tag: 'Admin',
    summary: 'Daily usage series',
    access: 'admin',
    query: [range],
  },
  {
    method: 'get',
    path: '/admin/analytics/commodities',
    tag: 'Admin',
    summary: 'Commodity ranking by views and chats',
    access: 'admin',
    query: [range],
  },
  {
    method: 'get',
    path: '/admin/data/status',
    tag: 'Admin',
    summary: 'Data freshness per refresh type',
    access: 'admin',
  },
  {
    method: 'get',
    path: '/admin/data/refresh-logs',
    tag: 'Admin',
    summary: 'Paginated refresh logs',
    access: 'admin',
    query: [
      { name: 'type', enum: REFRESH_TYPES },
      { name: 'status', enum: ['RUNNING', 'SUCCESS', 'FAILED'] },
      page,
      limit,
    ],
  },
  {
    method: 'post',
    path: '/admin/data/refresh',
    tag: 'Admin',
    summary: 'Trigger a refresh (ALL or one type)',
    access: 'admin',
    body: { type: 'ALL' },
  },
  {
    method: 'get',
    path: '/admin/accuracy',
    tag: 'Admin',
    summary: 'MAPE and direction hit rate',
    access: 'admin',
    query: [months],
  },
  {
    method: 'get',
    path: '/admin/feedback',
    tag: 'Admin',
    summary: 'Feedback inbox',
    access: 'admin',
    query: [
      { name: 'status', enum: FEEDBACK_STATUSES },
      { name: 'category', enum: FEEDBACK_CATEGORIES },
      page,
      limit,
    ],
  },
  {
    method: 'patch',
    path: '/admin/feedback/{id}',
    tag: 'Admin',
    summary: 'Update feedback status',
    access: 'admin',
    body: { status: 'REVIEWED' },
  },
  {
    method: 'get',
    path: '/admin/commodities',
    tag: 'Admin',
    summary: 'All commodities',
    access: 'admin',
  },
];

/** Builds path parameters from {slug}-style placeholders. */
function pathParameters(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function queryParameters(query: QueryParam[] = []) {
  return query.map(({ name, description, ...schema }) => ({
    name,
    in: 'query',
    required: false,
    ...(description ? { description } : {}),
    schema: { type: 'string', ...schema },
  }));
}

/** Auth schemes for an endpoint; an empty {} means no auth also works. */
function security(access: Access) {
  if (access === 'admin') return [{ bearerAuth: [] }];
  if (access === 'session') return [{ sessionId: [] }];
  return [{ sessionId: [] }, {}];
}

function requestBody(body: Record<string, unknown>) {
  return {
    required: true,
    content: { 'application/json': { schema: { type: 'object' }, example: body } },
  };
}

function responses({ access = 'public', status = 200 }: EndpointDoc) {
  return {
    [status]: { description: 'Success: { success: true, data, meta? }' },
    '400': { description: 'VALIDATION_ERROR (or missing X-Session-Id)' },
    ...(access === 'admin' ? { '401': { description: 'UNAUTHORIZED: missing or bad token' } } : {}),
    '404': { description: 'NOT_FOUND' },
    '429': { description: 'RATE_LIMITED' },
  };
}

function buildPaths() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of ENDPOINTS) {
    paths[endpoint.path] ??= {};
    paths[endpoint.path][endpoint.method] = {
      tags: [endpoint.tag],
      summary: endpoint.summary,
      parameters: [...pathParameters(endpoint.path), ...queryParameters(endpoint.query)],
      ...(endpoint.body ? { requestBody: requestBody(endpoint.body) } : {}),
      security: security(endpoint.access ?? 'public'),
      responses: responses(endpoint),
    };
  }
  return paths;
}

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Lagos Food Price Forecast API',
    version: '1.0.0',
    description: [
      'Monthly food price forecasts for 25 commodities in Lagos.',
      'All responses use `{ success, data, meta }` or `{ success: false, error }`.',
      '',
      '**How to test:** click **Authorize**. Paste any UUID into `sessionId` (needed for chat and analytics),',
      'and paste the token from `POST /admin/auth/login` into `bearerAuth` (needed for `/admin/*`).',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      sessionId: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Session-Id',
        description: 'Any UUID, e.g. 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
      },
    },
  },
  paths: buildPaths(),
};
