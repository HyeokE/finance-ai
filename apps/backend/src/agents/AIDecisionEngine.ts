import { IAIProvider } from '../infrastructure/api/IAIProvider';
import { OpenAIFactory } from '../infrastructure/api/OpenAIFactory';
import { GeminiApiFactory } from '../infrastructure/api/GeminiApiFactory';
import { AIInput, AIOutput, Decision } from '../model/AI';
import { getSystemPrompt } from './SystemPrompt';
import { logger } from '../util/logger';
import { AIError } from '../util/errors';
import { retryWithBackoff } from '../util/retry';

type AIProviderType = 'openai' | 'gemini';

/**
 * AI Decision Engine
 * Uses AI providers (OpenAI GPT or Google Gemini) to make trading decisions
 */
export class AIDecisionEngine {
    private aiProvider: IAIProvider;
    private providerType: AIProviderType;

    constructor() {
        this.providerType = this.getProviderFromEnv();
        this.aiProvider = this.createProvider(this.providerType);

        logger.info(`AI Decision Engine initialized with ${this.providerType} provider`);
    }

    /**
     * Get AI provider type from environment
     */
    private getProviderFromEnv(): AIProviderType {
        const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

        if (provider !== 'openai' && provider !== 'gemini') {
            logger.warn(`Invalid AI_PROVIDER: ${provider}, defaulting to openai`);
            return 'openai';
        }

        return provider as AIProviderType;
    }

    /**
     * Create AI provider instance based on type
     */
    private createProvider(type: AIProviderType): IAIProvider {
        switch (type) {
            case 'openai':
                const openaiFactory = new OpenAIFactory();
                return openaiFactory.create();

            case 'gemini':
                const geminiFactory = new GeminiApiFactory();
                return geminiFactory.create();

            default:
                throw new AIError(`Unknown AI provider type: ${type}`);
        }
    }

    /**
     * Get trading decisions from GPT-4o
     */
    async getDecisions(input: AIInput): Promise<AIOutput> {
        try {
            logger.info('Requesting AI decisions...', {
                stock_count: input.stocks.length,
                portfolio_equity: input.portfolio.total_equity,
            });

            const systemPrompt = getSystemPrompt();
            const userContext = this.formatInputContext(input);

            // Call AI provider with retry logic
            const responseText = await retryWithBackoff(
                () => this.aiProvider.getTradingDecision(systemPrompt, userContext),
                3,
                2000
            );

            // Parse JSON response
            const output = this.parseAIResponse(responseText);

            logger.info('AI decisions received', {
                decision_count: output.decisions.length,
                risk_level: output.risk_level,
            });

            // Validate output
            this.validateOutput(output);

            return output;
        } catch (error) {
            logger.error('AI decision engine failed', { error });
            throw new AIError('Failed to get AI decisions', undefined, error);
        }
    }

    /**
     * Format input context for GPT
     */
    private formatInputContext(input: AIInput): any {
        return {
            portfolio: {
                total_equity: input.portfolio.total_equity,
                cash: input.portfolio.cash,
                cash_ratio: input.portfolio.cash / input.portfolio.total_equity,
                positions: input.portfolio.positions.map((p) => ({
                    ticker: p.ticker,
                    quantity: p.quantity,
                    avg_price: p.avg_price,
                    current_price: p.current_price,
                    unrealized_pnl_pct: p.unrealized_pnl_pct,
                    weight: p.weight,
                })),
            },
            market: {
                kospi: {
                    price: input.market.index.KOSPI.price,
                    change_pct: input.market.index.KOSPI.change_pct,
                },
                kosdaq: {
                    price: input.market.index.KOSDAQ.price,
                    change_pct: input.market.index.KOSDAQ.change_pct,
                },
                sentiment: {
                    foreign_net_buy: input.market.sentiment.foreign_net_buy_krw,
                    institution_net_buy: input.market.sentiment.institution_net_buy_krw,
                },
            },
            stocks: input.stocks.map((s) => ({
                ticker: s.ticker,
                price: s.price,
                intraday_return: s.intraday_return,
                volume_ratio: s.volume_ratio,
                volatility: s.volatility_20d,
                ema5_position: s.ema5_position,
                ema20_position: s.ema20_position,
            })),
            constraints: input.constraints,
        };
    }

    /**
     * Parse AI response JSON
     */
    private parseAIResponse(responseText: string): AIOutput {
        try {
            // Remove markdown code blocks if present
            let cleanText = responseText.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleanText);

            return {
                decisions: parsed.decisions || [],
                market_view: parsed.market_view || '',
                risk_level: parsed.risk_level || 'medium',
            };
        } catch (error) {
            logger.error('Failed to parse AI response', { responseText, error });
            throw new AIError('Invalid AI response format', undefined, error);
        }
    }

    /**
     * Validate AI output structure
     */
    private validateOutput(output: AIOutput): void {
        if (!Array.isArray(output.decisions)) {
            throw new AIError('Decisions must be an array');
        }

        if (!output.market_view || typeof output.market_view !== 'string') {
            throw new AIError('Market view must be a string');
        }

        if (!['low', 'medium', 'high'].includes(output.risk_level)) {
            throw new AIError('Risk level must be low, medium, or high');
        }

        // Validate each decision
        for (const decision of output.decisions) {
            this.validateDecision(decision);
        }
    }

    /**
     * Validate single decision
     */
    private validateDecision(decision: Decision): void {
        if (!decision.ticker || typeof decision.ticker !== 'string') {
            throw new AIError('Decision must have a valid ticker');
        }

        if (!['BUY', 'SELL', 'HOLD'].includes(decision.action)) {
            throw new AIError(`Invalid action: ${decision.action}`);
        }

        if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 1) {
            throw new AIError(`Invalid confidence: ${decision.confidence}`);
        }

        if (!decision.reason || typeof decision.reason !== 'string') {
            throw new AIError('Decision must have a reason');
        }

        // Validate action-specific fields
        if (decision.action === 'BUY' && !decision.amount_krw) {
            throw new AIError('BUY decision must have amount_krw');
        }

        if (decision.action === 'SELL' && !decision.quantity) {
            throw new AIError('SELL decision must have quantity');
        }
    }

    /**
     * Test AI connectivity
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.aiProvider.testConnection();
            return true;
        } catch (error) {
            logger.error('AI connection test failed', { error });
            return false;
        }
    }

    /**
     * Get current provider type
     */
    getProviderType(): AIProviderType {
        return this.providerType;
    }
}
