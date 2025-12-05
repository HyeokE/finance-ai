import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ApiConfig, ApiFactory, DEFAULT_API_CONFIG } from './ApiFactory';
import { KISApiClient } from './KISApiClient';
import { logger } from '../../util/logger';

const DEFAULT_TIMEOUT = 30000;

/**
 * KIS API Factory
 * Creates and configures Korea Investment & Securities API client
 * Following Factory pattern from CODING_RULES.md
 */
export class KISApiFactory implements ApiFactory<KISApiClient> {
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;

    /**
     * Create KIS API client instance
     */
    create(config?: Partial<ApiConfig>): KISApiClient {
        const mode = process.env.MODE || 'paper';

        // Auto-select base URL based on mode
        let baseURL = config?.baseURL;
        if (!baseURL) {
            if (mode === 'live') {
                // Production/Live mode: Real trading
                baseURL = process.env.KIS_BASE_URL_PROD || 'https://openapi.koreainvestment.com:9443';
            } else {
                // Paper/Backtest mode: Virtual trading
                baseURL = process.env.KIS_BASE_URL_DEV || 'https://openapivts.koreainvestment.com:29443';
            }
        }

        logger.info('🔗 Initializing KIS API', {
            mode,
            baseURL,
            environment: mode === 'live' ? 'Production (Real Trading)' : 'Development (Virtual Trading)'
        });

        const axiosInstance = axios.create({
            baseURL,
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024, // 50MB response limit
            maxBodyLength: 50 * 1024 * 1024,    // 50MB request limit  
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
        });

        // Request interceptor: Auto-inject token and generate HashKey
        axiosInstance.interceptors.request.use(
            async (requestConfig) => {
                // Skip token injection for OAuth token request itself (prevent infinite loop!)
                if (requestConfig.url?.includes('/oauth2/tokenP')) {
                    return requestConfig;
                }

                // Ensure we have a valid token
                const token = await this.ensureValidToken(axiosInstance);
                requestConfig.headers.Authorization = `Bearer ${token}`;

                // Add required KIS headers
                requestConfig.headers['appkey'] = process.env.KIS_APP_KEY || '';
                requestConfig.headers['appsecret'] = process.env.KIS_APP_SECRET || '';

                // Generate HashKey for POST requests
                if (requestConfig.method === 'post' && requestConfig.data) {
                    const hashKey = this.generateHashKey(requestConfig.data);
                    requestConfig.headers['hashkey'] = hashKey;
                }

                return requestConfig;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor: Handle token expiry and log errors
        axiosInstance.interceptors.response.use(
            (response) => response,
            async (error) => {
                // Log detailed error information
                if (error.response) {
                    logger.error('KIS API Error Response', {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                        url: error.config?.url,
                        params: error.config?.params,
                    });
                }

                // If 401 unauthorized, token may be expired
                if (error.response?.status === 401) {
                    logger.warn('⚠️ KIS API token expired, refreshing...');
                    this.accessToken = null;
                    this.tokenExpiry = null;
                }
                return Promise.reject(error);
            }
        );

        return new KISApiClient(axiosInstance);
    }

    /**
     * Ensure we have a valid access token
     */
    private async ensureValidToken(axiosInstance: AxiosInstance): Promise<string> {
        // Check if token is still valid
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }

        // Request new token
        await this.requestAccessToken(axiosInstance);

        if (!this.accessToken) {
            throw new Error('Failed to obtain KIS access token');
        }

        return this.accessToken;
    }

    /**
     * Request new OAuth2 access token from KIS
     */
    private async requestAccessToken(axiosInstance: AxiosInstance): Promise<void> {
        try {
            const appKey = process.env.KIS_APP_KEY;
            const appSecret = process.env.KIS_APP_SECRET;

            if (!appKey || !appSecret) {
                logger.error('KIS_APP_KEY and KIS_APP_SECRET must be set in .env');
                throw new Error('KIS_APP_KEY and KIS_APP_SECRET must be set in .env');
            }

            logger.info('Requesting KIS OAuth token...');

            const response = await axiosInstance.post(
                '/oauth2/tokenP',
                {
                    grant_type: 'client_credentials',
                    appkey: appKey,
                    appsecret: appSecret,
                },
                {
                    // Skip interceptors for token request
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            this.accessToken = response.data.access_token;

            // Token valid for 24 hours, set expiry to 23:50 to be safe
            const expiryMinutes = 23 * 60 + 50;
            this.tokenExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

            logger.info('✅ KIS access token obtained', {
                expires_at: this.tokenExpiry.toISOString()
            });
        } catch (error: any) {
            logger.error('❌ Failed to obtain KIS access token', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    /**
     * Generate HashKey for POST requests
     * Required by KIS API for data integrity
     */
    private generateHashKey(data: any): string {
        const jsonString = JSON.stringify(data);
        const hash = crypto.createHash('sha256').update(jsonString).digest('base64');
        return hash;
    }
}
