'use server';

import { z } from 'zod';

const schema = z.object({
    name: z.string().min(2),
});

export async function sampleAction(data: z.infer<typeof schema>) {
    const result = schema.safeParse(data);

    if (!result.success) {
        return { success: false, error: result.error.flatten() };
    }

    // Simulate invalid operation or logic
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
        success: true,
        message: `Hello, ${result.data.name}! Server action executed successfully.`,
    };
}
