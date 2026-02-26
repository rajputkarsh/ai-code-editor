import { z } from 'zod';

const envSchema = z.object({
    APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
    DATABASE_URL: z.string().url().optional(), // Optional for now until DB is set up
    GEMINI_API_KEY: z.string().min(1, 'Gemini API key is required for AI chat functionality').optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required for authentication'),
    CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required for authentication').optional(),
    
    // GitHub OAuth (Phase 2)
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

    // Stripe billing (Phase 7)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_TEAM_MONTHLY_PRICE_ID: z.string().optional(),
    
    // AI Token Limits (with defaults)
    // These limits prevent runaway costs and abuse
    AI_MAX_TOKENS_PER_REQUEST: z.coerce.number().positive().default(10000),
    AI_MAX_INPUT_TOKENS: z.coerce.number().positive().default(8000),
    AI_MAX_TOKENS_PER_SESSION: z.coerce.number().positive().default(50000),

    // Workspace Limits (Phase 1.6 - Storage & Persistence)
    // These limits enforce storage quotas per user and prevent abuse
    WORKSPACE_MAX_COUNT_PER_USER: z.coerce.number().positive().default(10),
    WORKSPACE_MAX_STORAGE_BYTES: z.coerce.number().positive().default(100 * 1024 * 1024), // 100MB default

    // Stackblitz
    NEXT_PUBLIC_STACKBLITZ_CLIENT_ID: z.string().min(1, 'Stackblitz client ID is required for WebContainer integration'),
});

const processEnv = {
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    
    // GitHub OAuth
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRO_MONTHLY_PRICE_ID: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    STRIPE_TEAM_MONTHLY_PRICE_ID: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,

    // keys with default fallback values
    AI_MAX_TOKENS_PER_REQUEST: process.env.AI_MAX_TOKENS_PER_REQUEST,
    AI_MAX_INPUT_TOKENS: process.env.AI_MAX_INPUT_TOKENS,
    AI_MAX_TOKENS_PER_SESSION: process.env.AI_MAX_TOKENS_PER_SESSION,

    // Workspace limits
    WORKSPACE_MAX_COUNT_PER_USER: process.env.WORKSPACE_MAX_COUNT_PER_USER,
    WORKSPACE_MAX_STORAGE_BYTES: process.env.WORKSPACE_MAX_STORAGE_BYTES,

    // Stackblitz
    NEXT_PUBLIC_STACKBLITZ_CLIENT_ID: process.env.NEXT_PUBLIC_STACKBLITZ_CLIENT_ID,
};

// Parse and validate environment variables
const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}

export const env = parsed.data;
