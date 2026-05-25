const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });
if (process.env.DEBUG === 'true') {
  console.log(`[Config Debug] Loading .env from: ${envPath}`);
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().default('nexusops-dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('*'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  JIRA_BASE_URL: z.string().optional(),
  JIRA_EMAIL: z.string().optional(),
  JIRA_USER_EMAIL: z.string().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_WEB_API_KEY: z.string().optional(),
  SENTRY_WEBHOOK_SECRET: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  RAILWAY_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.3:70b'),
  OTLP_ENDPOINT: z.string().optional(),
  OTLP_SERVICE_NAME: z.string().default('nexusops-backend'),
  OLLAMA_FALLBACK_ENABLED: z.string().default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

module.exports = {
  config: {
    ...parsed.data,
    JIRA_EMAIL: parsed.data.JIRA_EMAIL || parsed.data.JIRA_USER_EMAIL,
  },
};
