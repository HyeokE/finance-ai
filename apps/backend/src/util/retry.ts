/**
 * Retry utility with exponential backoff
 */

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 10000)
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 10000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                console.error(`❌ Max retries (${maxRetries}) exceeded`);
                throw lastError;
            }

            // Calculate exponential backoff delay
            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

            console.warn(
                `⚠️ Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`,
                {
                    error: lastError.message,
                }
            );

            await sleep(delay);
        }
    }

    throw lastError || new Error('Retry failed');
}

/**
 * Retry with custom retry condition
 * 
 * @param fn - Function to retry
 * @param shouldRetry - Function that determines if retry should happen
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds
 */
export async function retryWithCondition<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: Error) => boolean,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (!shouldRetry(lastError)) {
                console.log('❌ Error is not retryable, throwing immediately');
                throw lastError;
            }

            if (attempt === maxRetries) {
                console.error(`❌ Max retries (${maxRetries}) exceeded`);
                throw lastError;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`⚠️ Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw lastError || new Error('Retry failed');
}
