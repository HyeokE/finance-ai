import OpenAI from 'openai';
import { ApiConfig, ApiFactory, DEFAULT_API_CONFIG } from './ApiFactory';
import { OpenAIClient } from './OpenAIClient';

/**
 * OpenAI API Factory
 * Creates and configures OpenAI API client
 * Following Factory pattern from CODING_RULES.md
 */
export class OpenAIFactory implements ApiFactory<OpenAIClient> {
    create(config: Partial<ApiConfig> = {}): OpenAIClient {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY must be set in .env');
        }

        const openai = new OpenAI({
            apiKey,
            timeout: config.timeout || DEFAULT_API_CONFIG.timeout,
            maxRetries: config.retryAttempts || DEFAULT_API_CONFIG.retryAttempts,
        });

        console.log('✅ OpenAI client initialized');

        return new OpenAIClient(openai);
    }
}
