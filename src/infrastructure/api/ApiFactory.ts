/**
 * Base API Configuration Interface
 */
export interface ApiConfig {
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
    retryAttempts?: number;
}

/**
 * Base API Factory Interface
 * All API factories must implement this interface
 */
export interface ApiFactory<T> {
    create(config: ApiConfig): T;
}

/**
 * Default API Configuration
 */
export const DEFAULT_API_CONFIG: Partial<ApiConfig> = {
    timeout: 10000,
    retryAttempts: 3,
    headers: {
        'Content-Type': 'application/json',
    },
};
