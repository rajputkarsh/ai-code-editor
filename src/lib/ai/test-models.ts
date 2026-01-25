/**
 * Utility to test and list available Gemini models
 * Run this to see what models are available with your API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function listAvailableModels(apiKey: string) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Try to list models (if the SDK supports it)
        console.log('Testing Gemini API connection...');
        
        // Test different model names
        const modelsToTest = [
            'gemini-pro',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'models/gemini-pro',
            'models/gemini-1.5-pro',
        ];
        
        console.log('\nTesting model availability:');
        for (const modelName of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('test');
                console.log(`✅ ${modelName} - Available`);
                return modelName; // Return first working model
            } catch (error) {
                console.log(`❌ ${modelName} - Not available:`, error instanceof Error ? error.message : 'Unknown error');
            }
        }
        
        throw new Error('No working models found');
    } catch (error) {
        console.error('Error testing models:', error);
        throw error;
    }
}

// For manual testing in Node.js
if (require.main === module) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Please set GEMINI_API_KEY environment variable');
        process.exit(1);
    }
    
    listAvailableModels(apiKey)
        .then((workingModel) => {
            console.log(`\n🎉 Use this model: "${workingModel}"`);
        })
        .catch((error) => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

