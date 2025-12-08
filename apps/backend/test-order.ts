/**
 * Test script to verify TR-ID fix for domestic stock orders
 */
import 'dotenv/config';
import { KISApiFactory } from './src/infrastructure/api/KISApiFactory';

async function testOrder() {
    try {
        console.log('🧪 Testing domestic stock order TR-ID fix...\n');

        // Create KIS API client
        const factory = KISApiFactory.getInstance();
        const kisApi = factory.create();

        // Test account (from .env)
        const accountNumber = process.env.KIS_ACCOUNT_NUMBER || '50157719-01';
        const ticker = '005930'; // Samsung Electronics
        const quantity = 1; // Buy 1 share as test

        console.log('📝 Test parameters:');
        console.log(`  Account: ${accountNumber}`);
        console.log(`  Ticker: ${ticker}`);
        console.log(`  Quantity: ${quantity}`);
        console.log(`  Mode: ${process.env.MODE || 'paper'}\n`);

        console.log('🔄 Attempting buy order...');
        const response = await kisApi.buyOrder(accountNumber, ticker, quantity, 0, '00');

        console.log('\n✅ Order placed successfully!');
        console.log('Response:', JSON.stringify(response, null, 2));

    } catch (error: any) {
        console.error('\n❌ Order failed:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testOrder();
