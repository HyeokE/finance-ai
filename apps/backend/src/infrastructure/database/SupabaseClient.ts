import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Supabase Client Singleton
 * Manages database connection for Auto-Finance system
 */
export class SupabaseClientManager {
    private static instance: SupabaseClient | null = null;

    /**
     * Get Supabase client instance (singleton pattern)
     */
    static getInstance(): SupabaseClient {
        if (!this.instance) {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) {
                throw new Error(
                    'Supabase credentials are missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env'
                );
            }

            this.instance = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            console.log('✅ Supabase client initialized');
        }

        return this.instance;
    }

    /**
     * Test database connectivity
     */
    static async testConnection(): Promise<boolean> {
        try {
            const client = this.getInstance();
            const { error } = await client.from('runs').select('id').limit(1);

            if (error) {
                console.error('❌ Supabase connection test failed:', error.message);
                return false;
            }

            console.log('✅ Supabase connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error);
            return false;
        }
    }
}

// Export convenience getter
export const getSupabaseClient = (): SupabaseClient => {
    return SupabaseClientManager.getInstance();
};
