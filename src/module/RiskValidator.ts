import { Decision, Constraints } from '../model/AI';
import { Portfolio } from '../model/Trading';
import { logger } from '../util/logger';
import { ValidationError } from '../util/errors';

/**
 * Risk Validator Module
 * Validates AI decisions against risk constraints and portfolio limits
 */
export class RiskValidator {
    constructor(private constraints: Constraints) { }

    /**
     * Validate all decisions against constraints
     */
    validateDecisions(decisions: Decision[], portfolio: Portfolio): Decision[] {
        logger.info('Validating decisions...', { count: decisions.length });

        const validatedDecisions: Decision[] = [];

        for (const decision of decisions) {
            try {
                const validated = this.validateDecision(decision, portfolio, validatedDecisions);
                if (validated) {
                    validatedDecisions.push(validated);
                }
            } catch (error) {
                logger.warn('Decision failed validation', {
                    ticker: decision.ticker,
                    action: decision.action,
                    error,
                });
            }
        }

        logger.info('Validation complete', {
            input_count: decisions.length,
            output_count: validatedDecisions.length,
        });

        return validatedDecisions;
    }

    /**
     * Validate a single decision
     */
    private validateDecision(
        decision: Decision,
        portfolio: Portfolio,
        acceptedDecisions: Decision[]
    ): Decision | null {
        // Skip HOLD decisions
        if (decision.action === 'HOLD') {
            return null;
        }

        // Check confidence threshold
        if (decision.confidence < this.constraints.min_confidence_to_trade) {
            logger.warn('Decision below confidence threshold', {
                ticker: decision.ticker,
                confidence: decision.confidence,
                threshold: this.constraints.min_confidence_to_trade,
            });
            return null;
        }

        // Check minimum order amount
        if (decision.amount_krw && decision.amount_krw < this.constraints.min_order_amount) {
            logger.warn('Order amount below minimum', {
                ticker: decision.ticker,
                amount: decision.amount_krw,
                minimum: this.constraints.min_order_amount,
            });
            return null;
        }

        // Check max trades per batch
        if (acceptedDecisions.length >= this.constraints.max_trades_per_batch) {
            logger.warn('Max trades per batch reached', {
                max: this.constraints.max_trades_per_batch,
            });
            return null;
        }

        // Validate BUY decision
        if (decision.action === 'BUY') {
            return this.validateBuyDecision(decision, portfolio, acceptedDecisions);
        }

        // Validate SELL decision
        if (decision.action === 'SELL') {
            return this.validateSellDecision(decision, portfolio);
        }

        return null;
    }

    /**
     * Validate BUY decision
     */
    private validateBuyDecision(
        decision: Decision,
        portfolio: Portfolio,
        acceptedDecisions: Decision[]
    ): Decision | null {
        const buyAmount = decision.amount_krw || 0;

        // Check if we have enough cash
        const totalBuyAmount = acceptedDecisions
            .filter((d) => d.action === 'BUY')
            .reduce((sum, d) => sum + (d.amount_krw || 0), 0);

        if (buyAmount + totalBuyAmount > portfolio.cash) {
            logger.warn('Insufficient cash for buy order', {
                ticker: decision.ticker,
                required: buyAmount + totalBuyAmount,
                available: portfolio.cash,
            });

            // Adjust amount to available cash
            const availableCash = portfolio.cash - totalBuyAmount;
            if (availableCash < this.constraints.min_order_amount) {
                return null;
            }

            decision.amount_krw = availableCash;
        }

        // Check position weight limit
        const futurePositionValue = buyAmount;
        const futureWeight = futurePositionValue / portfolio.total_equity;

        if (futureWeight > this.constraints.max_position_weight) {
            logger.warn('Position weight exceeds limit', {
                ticker: decision.ticker,
                future_weight: futureWeight,
                max: this.constraints.max_position_weight,
            });

            // Adjust to max position weight
            const maxAmount = portfolio.total_equity * this.constraints.max_position_weight;
            decision.amount_krw = Math.min(buyAmount, maxAmount);
        }

        // Check total investment ratio
        const currentInvestment = portfolio.total_equity - portfolio.cash;
        const futureInvestment = currentInvestment + buyAmount;
        const futureRatio = futureInvestment / portfolio.total_equity;

        if (futureRatio > this.constraints.max_total_investment) {
            logger.warn('Total investment ratio exceeds limit', {
                future_ratio: futureRatio,
                max: this.constraints.max_total_investment,
            });

            // Adjust to maintain max investment ratio
            const maxInvestment = portfolio.total_equity * this.constraints.max_total_investment;
            const availableInvestment = maxInvestment - currentInvestment;

            if (availableInvestment < this.constraints.min_order_amount) {
                return null;
            }

            decision.amount_krw = Math.min(buyAmount, availableInvestment);
        }

        return decision;
    }

    /**
     * Validate SELL decision
     */
    private validateSellDecision(decision: Decision, portfolio: Portfolio): Decision | null {
        // Check if we hold this position
        const position = portfolio.positions.find((p) => p.ticker === decision.ticker);

        if (!position) {
            logger.warn('Cannot sell - position not found', { ticker: decision.ticker });
            return null;
        }

        // Check sell quantity
        const sellQty = decision.quantity || 0;

        if (sellQty > position.quantity) {
            logger.warn('Sell quantity exceeds holdings', {
                ticker: decision.ticker,
                requested: sellQty,
                available: position.quantity,
            });

            // Adjust to available quantity
            decision.quantity = position.quantity;
        }

        // Check stop loss trigger
        if (position.unrealized_pnl_pct <= this.constraints.stop_loss_pct) {
            logger.info('Stop loss triggered', {
                ticker: decision.ticker,
                pnl_pct: position.unrealized_pnl_pct,
                stop_loss: this.constraints.stop_loss_pct,
            });

            // Force sell entire position on stop loss
            decision.quantity = position.quantity;
            decision.reason = `STOP LOSS: ${decision.reason}`;
        }

        return decision;
    }

    /**
     * Calculate portfolio risk metrics
     */
    calculateRiskMetrics(portfolio: Portfolio): {
        cash_ratio: number;
        investment_ratio: number;
        max_position_weight: number;
        position_count: number;
    } {
        const cashRatio = portfolio.cash / portfolio.total_equity;
        const investmentRatio = 1 - cashRatio;
        const maxPositionWeight = Math.max(...portfolio.positions.map((p) => p.weight));

        return {
            cash_ratio: cashRatio,
            investment_ratio: investmentRatio,
            max_position_weight: maxPositionWeight,
            position_count: portfolio.positions.length,
        };
    }
}
