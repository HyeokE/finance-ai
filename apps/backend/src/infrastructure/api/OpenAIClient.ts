import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { IAIProvider } from './IAIProvider';

/**
 * OpenAI API Client Wrapper
 * Provides simplified interface for GPT calls
 */
export class OpenAIClient implements IAIProvider {
    constructor(
        private readonly openai: OpenAI,
        private readonly modelName: string = 'gpt-4o'
    ) { }

    /**
     * Call GPT-4o with chat completion
     */
    async chat(
        messages: ChatCompletionMessageParam[],
        options: {
            model?: string;
            temperature?: number;
            jsonMode?: boolean;
            maxTokens?: number;
        } = {}
    ): Promise<string> {
        const {
            model = this.modelName,
            temperature = 0.7,
            jsonMode = false,
            maxTokens,
        } = options;

        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages,
                temperature,
                ...(jsonMode && { response_format: { type: 'json_object' } }),
                ...(maxTokens && { max_tokens: maxTokens }),
            });

            const content = response.choices[0]?.message?.content;

            if (!content) {
                throw new Error('No response from OpenAI API');
            }

            return content;
        } catch (error) {
            console.error('❌ OpenAI API error:', error);
            throw error;
        }
    }

    /**
     * Get trading decision from GPT
     * Convenience method for AI decision engine
     */
    async getTradingDecision(systemPrompt: string, context: any): Promise<string> {
        const messages: ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: JSON.stringify(context),
            },
        ];

        return this.chat(messages, {
            model: this.modelName,
            temperature: 0.7,
            jsonMode: true,
        });
    }

    /**
     * Test API connectivity
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.chat([{ role: 'user', content: 'Hello' }], {
                model: this.modelName,
                maxTokens: 10,
            });
            console.log('✅ OpenAI API connection test successful');
            return true;
        } catch (error) {
            console.error('❌ OpenAI API connection test failed:', error);
            return false;
        }
    }
}
