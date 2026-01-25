import { z } from 'zod';

const envSchema = z.object({
    APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
    DATABASE_URL: z.string().url().optional(), // Optional for now until DB is set up
    GEMINI_API_KEY: z.string().min(1, 'Gemini API key is required for AI chat functionality'),
    
    // AI Token Limits (with defaults)
    // These limits prevent runaway costs and abuse
    AI_MAX_TOKENS_PER_REQUEST: z.coerce.number().positive().default(10000),
    AI_MAX_INPUT_TOKENS: z.coerce.number().positive().default(8000),
    AI_MAX_TOKENS_PER_SESSION: z.coerce.number().positive().default(50000),
});

const processEnv = {
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    
    // Token limits - use env vars if provided, otherwise defaults from schema
    AI_MAX_TOKENS_PER_REQUEST: process.env.AI_MAX_TOKENS_PER_REQUEST,
    AI_MAX_INPUT_TOKENS: process.env.AI_MAX_INPUT_TOKENS,
    AI_MAX_TOKENS_PER_SESSION: process.env.AI_MAX_TOKENS_PER_SESSION,
};

// Parse and validate environment variables
const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}

export const env = parsed.data;
