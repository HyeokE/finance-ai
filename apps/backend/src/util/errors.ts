/**
 * Custom Error Classes for Auto-Finance System
 */

/**
 * Base error class
 */
export class AutoFinanceError extends Error {
    constructor(
        message: string,
        public code?: string,
        public details?: any
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * API-related errors
 */
export class ApiError extends AutoFinanceError {
    constructor(message: string, code?: string, details?: any) {
        super(message, code, details);
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AutoFinanceError {
    constructor(message: string, code?: string, details?: any) {
        super(message, code, details);
    }
}

/**
 * Database errors
 */
export class DatabaseError extends AutoFinanceError {
    constructor(message: string, code?: string, details?: any) {
        super(message, code, details);
    }
}

/**
 * Trading execution errors
 */
export class TradingError extends AutoFinanceError {
    constructor(message: string, code?: string, details?: any) {
        super(message, code, details);
    }
}

/**
 * AI decision errors
 */
export class AIError extends AutoFinanceError {
    constructor(message: string, code?: string, details?: any) {
        super(message, code, details);
    }
}
