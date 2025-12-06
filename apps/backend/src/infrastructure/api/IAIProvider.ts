/**
 * Common AI Provider Interface
 * Abstracts different AI providers (OpenAI, Gemini, etc.)
 */
export interface IAIProvider {
    /**
     * Get trading decision from AI model
     * @param systemPrompt - The system instruction for the AI
     * @param context - The trading context data
     * @returns JSON string with trading decisions
     */
    getTradingDecision(systemPrompt: string, context: any): Promise<string>;

    /**
     * Test API connectivity
     * @returns true if connection successful, false otherwise
     */
    testConnection(): Promise<boolean>;
}
