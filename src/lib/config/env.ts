import { z } from 'zod';

const envSchema = z.object({
    APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
    DATABASE_URL: z.string().url().optional(), // Optional for now until DB is set up
});

const processEnv = {
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
};

// Parse and validate environment variables
const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}

export const env = parsed.data;
