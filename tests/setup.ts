// Test setup: no LLM key (so the fallback chatbot is used) and no cron jobs.
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = '';
process.env.ENABLE_CRON = 'false';
