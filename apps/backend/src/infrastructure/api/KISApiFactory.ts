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
 * 
 * Singleton pattern to share access token across all instances
 */
export class KISApiFactory implements ApiFactory<KISApiClient> {
    private static instance: KISApiFactory | null = null;
    private static accessToken: string | null = null;
    private static tokenExpiry: Date | null = null;
    private static tokenRequestInProgress: boolean = false;
    private static tokenRequestPromise: Promise<string> | null = null;

    /**
     * Get singleton instance
     */
    static getInstance(): KISApiFactory {
        if (!KISApiFactory.instance) {
            KISApiFactory.instance = new KISApiFactory();
        }
        return KISApiFactory.instance;
    }

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

                // Generate HashKey for POST requests (except overseas stock orders)
                // 해외 주식 주문은 hashkey가 필요 없거나 다른 방식으로 처리됩니다
                if (requestConfig.method === 'post' && requestConfig.data && 
                    !requestConfig.url?.includes('/overseas-stock/v1/trading/order')) {
                    const hashKey = this.generateHashKey(requestConfig.data);
                    requestConfig.headers['hashkey'] = hashKey;
                }

                return requestConfig;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor: Log all responses and handle token expiry
        axiosInstance.interceptors.response.use(
            (response) => {
                // Log successful API response
                logger.info('📡 KIS API Response', {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.config?.url,
                    method: response.config?.method?.toUpperCase(),
                    params: response.config?.params,
                    data: response.data,
                });
                return response;
            },
            async (error) => {
                // Log detailed error information
                if (error.response) {
                    logger.error('❌ KIS API Error Response', {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                        url: error.config?.url,
                        method: error.config?.method?.toUpperCase(),
                        params: error.config?.params,
                    });
                } else if (error.request) {
                    logger.error('❌ KIS API Request Error', {
                        message: error.message,
                        url: error.config?.url,
                        method: error.config?.method?.toUpperCase(),
                    });
                }

                // If 401 unauthorized, token may be expired
                if (error.response?.status === 401) {
                    logger.warn('⚠️ KIS API token expired, refreshing...');
                    KISApiFactory.accessToken = null;
                    KISApiFactory.tokenExpiry = null;
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
        if (KISApiFactory.accessToken && KISApiFactory.tokenExpiry && new Date() < KISApiFactory.tokenExpiry) {
            return KISApiFactory.accessToken;
        }

        // If token request is already in progress, wait for it
        if (KISApiFactory.tokenRequestInProgress && KISApiFactory.tokenRequestPromise) {
            try {
                return await KISApiFactory.tokenRequestPromise;
            } catch (error) {
                // If the in-progress request failed, try again
                KISApiFactory.tokenRequestInProgress = false;
                KISApiFactory.tokenRequestPromise = null;
            }
        }

        // Request new token (with lock to prevent concurrent requests)
        KISApiFactory.tokenRequestInProgress = true;
        KISApiFactory.tokenRequestPromise = (async () => {
            try {
                await this.requestAccessToken(axiosInstance);
                if (!KISApiFactory.accessToken) {
                    throw new Error('Failed to obtain KIS access token');
                }
                return KISApiFactory.accessToken;
            } finally {
                KISApiFactory.tokenRequestInProgress = false;
                KISApiFactory.tokenRequestPromise = null;
            }
        })();

        return await KISApiFactory.tokenRequestPromise;
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

            KISApiFactory.accessToken = response.data.access_token;

            // Token valid for 24 hours, set expiry to 23:50 to be safe
            const expiryMinutes = 23 * 60 + 50;
            KISApiFactory.tokenExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

            logger.info('✅ KIS access token obtained', {
                expires_at: KISApiFactory.tokenExpiry.toISOString()
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
