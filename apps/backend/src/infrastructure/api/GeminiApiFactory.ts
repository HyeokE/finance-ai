import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiConfig, ApiFactory, DEFAULT_API_CONFIG } from './ApiFactory';
import { GeminiApiClient } from './GeminiApiClient';

/**
 * Gemini API Factory
 * Creates and configures Gemini API client
 * Following Factory pattern from CODING_RULES.md
 */
export class GeminiApiFactory implements ApiFactory<GeminiApiClient> {
    create(config: Partial<ApiConfig> = {}): GeminiApiClient {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY must be set in .env');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

        console.log(`✅ Gemini client initialized (model: ${modelName})`);

        return new GeminiApiClient(genAI, modelName);
    }
}
