/**
 * Structured logging utility
 */

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    CRITICAL = 'critical',
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.CRITICAL]: 4,
};

class Logger {
    private currentLevel: LogLevel;

    constructor() {
        const envLevel = (process.env.LOG_LEVEL?.toLowerCase() || 'info') as LogLevel;
        this.currentLevel = envLevel in LogLevel ? envLevel : LogLevel.INFO;
    }

    /**
     * Set log level
     */
    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    /**
     * Check if a level should be logged
     */
    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.currentLevel];
    }

    /**
     * Format and output log message
     */
    private log(level: LogLevel, message: string, meta?: Record<string, any>): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta,
        };

        // Use appropriate console method
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(JSON.stringify(logEntry));
                break;
            case LogLevel.INFO:
                console.info(JSON.stringify(logEntry));
                break;
            case LogLevel.WARN:
                console.warn(JSON.stringify(logEntry));
                break;
            case LogLevel.ERROR:
            case LogLevel.CRITICAL:
                console.error(JSON.stringify(logEntry));
                break;
        }
    }

    /**
     * Debug level logging
     */
    debug(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, meta);
    }

    /**
     * Info level logging
     */
    info(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, meta);
    }

    /**
     * Warning level logging
     */
    warn(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, meta);
    }

    /**
     * Error level logging
     */
    error(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, meta);
    }

    /**
     * Critical level logging
     */
    critical(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.CRITICAL, message, meta);
    }
}

// Export singleton logger instance
export const logger = new Logger();
