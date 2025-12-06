import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { IAIProvider } from './IAIProvider';

/**
 * Gemini API Client Wrapper
 * Provides simplified interface for Gemini calls
 */
export class GeminiApiClient implements IAIProvider {
    private model: GenerativeModel;

    constructor(private readonly genAI: GoogleGenerativeAI, modelName: string = 'gemini-3-pro-preview') {
        this.model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.7,
                responseMimeType: 'application/json',
            }
        });
    }

    /**
     * Get trading decision from Gemini
     * Convenience method for AI decision engine
     */
    async getTradingDecision(systemPrompt: string, context: any): Promise<string> {
        try {
            const prompt = `${systemPrompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            if (!text) {
                throw new Error('No response from Gemini API');
            }

            return text;
        } catch (error) {
            console.error('❌ Gemini API error:', error);
            throw error;
        }
    }

    /**
     * Test API connectivity
     */
    async testConnection(): Promise<boolean> {
        try {
            const result = await this.model.generateContent('Hello');
            const text = result.response.text();

            if (text) {
                console.log('✅ Gemini API connection test successful');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Gemini API connection test failed:', error);
            return false;
        }
    }
}
