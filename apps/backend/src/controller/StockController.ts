import { Request, Response } from 'express';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { Market } from '../model/Trading';
import { logger } from '../util/logger';
import { kisRateLimiter } from '../util/rateLimiter';

// Korean stock database - top 100 most traded stocks
const KOREAN_STOCKS = [
    { ticker: '005930', name: '삼성전자', nameEn: 'Samsung Electronics' },
    { ticker: '000660', name: 'SK하이닉스', nameEn: 'SK Hynix' },
    { ticker: '035420', name: 'NAVER', nameEn: 'NAVER' },
    { ticker: '005380', name: '현대차', nameEn: 'Hyundai Motor' },
    { ticker: '051910', name: 'LG화학', nameEn: 'LG Chem' },
    { ticker: '006400', name: '삼성SDI', nameEn: 'Samsung SDI' },
    { ticker: '035720', name: '카카오', nameEn: 'Kakao' },
    { ticker: '068270', name: '셀트리온', nameEn: 'Celltrion' },
    { ticker: '207940', name: '삼성바이오로직스', nameEn: 'Samsung Biologics' },
    { ticker: '005490', name: 'POSCO홀딩스', nameEn: 'POSCO Holdings' },
    { ticker: '012330', name: '현대모비스', nameEn: 'Hyundai Mobis' },
    { ticker: '028260', name: '삼성물산', nameEn: 'Samsung C&T' },
    { ticker: '066570', name: 'LG전자', nameEn: 'LG Electronics' },
    { ticker: '003670', name: '포스코퓨처엠', nameEn: 'POSCO Future M' },
    { ticker: '000270', name: '기아', nameEn: 'Kia' },
    { ticker: '096770', name: 'SK이노베이션', nameEn: 'SK Innovation' },
    { ticker: '009150', name: '삼성전기', nameEn: 'Samsung Electro-Mechanics' },
    { ticker: '105560', name: 'KB금융', nameEn: 'KB Financial Group' },
    { ticker: '055550', name: '신한지주', nameEn: 'Shinhan Financial Group' },
    { ticker: '034730', name: 'SK', nameEn: 'SK Inc' },
    { ticker: '032830', name: '삼성생명', nameEn: 'Samsung Life Insurance' },
    { ticker: '015760', name: '한국전력', nameEn: 'KEPCO' },
    { ticker: '017670', name: 'SK텔레콤', nameEn: 'SK Telecom' },
    { ticker: '030200', name: 'KT', nameEn: 'KT' },
    { ticker: '003550', name: 'LG', nameEn: 'LG Corp' },
    { ticker: '010950', name: 'S-Oil', nameEn: 'S-Oil' },
    { ticker: '086790', name: '하나금융지주', nameEn: 'Hana Financial Group' },
    { ticker: '011170', name: '롯데케미칼', nameEn: 'Lotte Chemical' },
    { ticker: '047810', name: '한국항공우주', nameEn: 'Korea Aerospace Industries' },
    { ticker: '090430', name: '아모레퍼시픽', nameEn: 'Amorepacific' },
    { ticker: '018260', name: '삼성에스디에스', nameEn: 'Samsung SDS' },
    { ticker: '011200', name: 'HMM', nameEn: 'HMM' },
    { ticker: '009540', name: 'HD한국조선해양', nameEn: 'HD Korea Shipbuilding' },
    { ticker: '010130', name: '고려아연', nameEn: 'Korea Zinc' },
    { ticker: '011070', name: 'LG이노텍', nameEn: 'LG Innotek' },
    { ticker: '036570', name: '엔씨소프트', nameEn: 'NCSOFT' },
    { ticker: '323410', name: '카카오뱅크', nameEn: 'Kakao Bank' },
    { ticker: '003490', name: '대한항공', nameEn: 'Korean Air' },
    { ticker: '000810', name: '삼성화재', nameEn: 'Samsung Fire & Marine Insurance' },
    { ticker: '251270', name: '넷마블', nameEn: 'Netmarble' },
    { ticker: '352820', name: '하이브', nameEn: 'HYBE' },
    { ticker: '042700', name: '한미반도체', nameEn: 'Hanmi Semiconductor' },
    { ticker: '247540', name: '에코프로비엠', nameEn: 'EcoPro BM' },
    { ticker: '086520', name: '에코프로', nameEn: 'EcoPro' },
    { ticker: '373220', name: 'LG에너지솔루션', nameEn: 'LG Energy Solution' },
];

// US stock database - popular US stocks
const US_STOCKS = [
    { ticker: 'AAPL', name: 'Apple Inc.', nameEn: 'Apple Inc.' },
    { ticker: 'MSFT', name: 'Microsoft Corporation', nameEn: 'Microsoft Corporation' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', nameEn: 'Alphabet Inc.' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', nameEn: 'Amazon.com Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', nameEn: 'NVIDIA Corporation' },
    { ticker: 'META', name: 'Meta Platforms Inc.', nameEn: 'Meta Platforms Inc.' },
    { ticker: 'TSLA', name: 'Tesla, Inc.', nameEn: 'Tesla, Inc.' },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', nameEn: 'Berkshire Hathaway Inc.' },
    { ticker: 'V', name: 'Visa Inc.', nameEn: 'Visa Inc.' },
    { ticker: 'JNJ', name: 'Johnson & Johnson', nameEn: 'Johnson & Johnson' },
    { ticker: 'WMT', name: 'Walmart Inc.', nameEn: 'Walmart Inc.' },
    { ticker: 'JPM', name: 'JPMorgan Chase & Co.', nameEn: 'JPMorgan Chase & Co.' },
    { ticker: 'MA', name: 'Mastercard Incorporated', nameEn: 'Mastercard Incorporated' },
    { ticker: 'PG', name: 'The Procter & Gamble Company', nameEn: 'The Procter & Gamble Company' },
    { ticker: 'UNH', name: 'UnitedHealth Group Incorporated', nameEn: 'UnitedHealth Group Incorporated' },
    { ticker: 'HD', name: 'The Home Depot, Inc.', nameEn: 'The Home Depot, Inc.' },
    { ticker: 'DIS', name: 'The Walt Disney Company', nameEn: 'The Walt Disney Company' },
    { ticker: 'BAC', name: 'Bank of America Corp.', nameEn: 'Bank of America Corp.' },
    { ticker: 'ADBE', name: 'Adobe Inc.', nameEn: 'Adobe Inc.' },
    { ticker: 'NFLX', name: 'Netflix, Inc.', nameEn: 'Netflix, Inc.' },
    { ticker: 'CRM', name: 'Salesforce, Inc.', nameEn: 'Salesforce, Inc.' },
    { ticker: 'PYPL', name: 'PayPal Holdings, Inc.', nameEn: 'PayPal Holdings, Inc.' },
    { ticker: 'INTC', name: 'Intel Corporation', nameEn: 'Intel Corporation' },
    { ticker: 'CMCSA', name: 'Comcast Corporation', nameEn: 'Comcast Corporation' },
    { ticker: 'PEP', name: 'PepsiCo, Inc.', nameEn: 'PepsiCo, Inc.' },
    { ticker: 'COST', name: 'Costco Wholesale Corporation', nameEn: 'Costco Wholesale Corporation' },
    { ticker: 'TMO', name: 'Thermo Fisher Scientific Inc.', nameEn: 'Thermo Fisher Scientific Inc.' },
    { ticker: 'AVGO', name: 'Broadcom Inc.', nameEn: 'Broadcom Inc.' },
    { ticker: 'CSCO', name: 'Cisco Systems, Inc.', nameEn: 'Cisco Systems, Inc.' },
    { ticker: 'ABT', name: 'Abbott Laboratories', nameEn: 'Abbott Laboratories' },
    { ticker: 'ACN', name: 'Accenture plc', nameEn: 'Accenture plc' },
    { ticker: 'NKE', name: 'Nike, Inc.', nameEn: 'Nike, Inc.' },
    { ticker: 'TXN', name: 'Texas Instruments Incorporated', nameEn: 'Texas Instruments Incorporated' },
    { ticker: 'DHR', name: 'Danaher Corporation', nameEn: 'Danaher Corporation' },
    { ticker: 'VZ', name: 'Verizon Communications Inc.', nameEn: 'Verizon Communications Inc.' },
    { ticker: 'LIN', name: 'Linde plc', nameEn: 'Linde plc' },
    { ticker: 'PM', name: 'Philip Morris International Inc.', nameEn: 'Philip Morris International Inc.' },
    { ticker: 'NEE', name: 'NextEra Energy, Inc.', nameEn: 'NextEra Energy, Inc.' },
    { ticker: 'QCOM', name: 'QUALCOMM Incorporated', nameEn: 'QUALCOMM Incorporated' },
    { ticker: 'RTX', name: 'RTX Corporation', nameEn: 'RTX Corporation' },
    { ticker: 'HON', name: 'Honeywell International Inc.', nameEn: 'Honeywell International Inc.' },
    { ticker: 'AMGN', name: 'Amgen Inc.', nameEn: 'Amgen Inc.' },
    { ticker: 'AMAT', name: 'Applied Materials, Inc.', nameEn: 'Applied Materials, Inc.' },
    { ticker: 'LOW', name: "Lowe's Companies, Inc.", nameEn: "Lowe's Companies, Inc." },
    { ticker: 'INTU', name: 'Intuit Inc.', nameEn: 'Intuit Inc.' },
    { ticker: 'BKNG', name: 'Booking Holdings Inc.', nameEn: 'Booking Holdings Inc.' },
    { ticker: 'SBUX', name: 'Starbucks Corporation', nameEn: 'Starbucks Corporation' },
    { ticker: 'GILD', name: 'Gilead Sciences, Inc.', nameEn: 'Gilead Sciences, Inc.' },
    { ticker: 'ADP', name: 'Automatic Data Processing, Inc.', nameEn: 'Automatic Data Processing, Inc.' },
    { ticker: 'ISRG', name: 'Intuitive Surgical, Inc.', nameEn: 'Intuitive Surgical, Inc.' },
    { ticker: 'GE', name: 'General Electric Company', nameEn: 'General Electric Company' },
    { ticker: 'MDT', name: 'Medtronic plc', nameEn: 'Medtronic plc' },
    { ticker: 'AMT', name: 'American Tower Corporation', nameEn: 'American Tower Corporation' },
    { ticker: 'SPGI', name: 'S&P Global Inc.', nameEn: 'S&P Global Inc.' },
    { ticker: 'ZTS', name: 'Zoetis Inc.', nameEn: 'Zoetis Inc.' },
    { ticker: 'EQIX', name: 'Equinix, Inc.', nameEn: 'Equinix, Inc.' },
    { ticker: 'REGN', name: 'Regeneron Pharmaceuticals, Inc.', nameEn: 'Regeneron Pharmaceuticals, Inc.' },
    { ticker: 'CDNS', name: 'Cadence Design Systems, Inc.', nameEn: 'Cadence Design Systems, Inc.' },
    { ticker: 'SNPS', name: 'Synopsys, Inc.', nameEn: 'Synopsys, Inc.' },
    { ticker: 'KLAC', name: 'KLA Corporation', nameEn: 'KLA Corporation' },
    { ticker: 'FTNT', name: 'Fortinet, Inc.', nameEn: 'Fortinet, Inc.' },
    { ticker: 'NXPI', name: 'NXP Semiconductors N.V.', nameEn: 'NXP Semiconductors N.V.' },
    { ticker: 'MCHP', name: 'Microchip Technology Incorporated', nameEn: 'Microchip Technology Incorporated' },
    { ticker: 'MRVL', name: 'Marvell Technology, Inc.', nameEn: 'Marvell Technology, Inc.' },
    { ticker: 'ANSS', name: 'ANSYS, Inc.', nameEn: 'ANSYS, Inc.' },
    { ticker: 'CTSH', name: 'Cognizant Technology Solutions Corporation', nameEn: 'Cognizant Technology Solutions Corporation' },
    { ticker: 'WDAY', name: 'Workday, Inc.', nameEn: 'Workday, Inc.' },
    { ticker: 'TEAM', name: 'Atlassian Corporation', nameEn: 'Atlassian Corporation' },
    { ticker: 'ZM', name: 'Zoom Video Communications, Inc.', nameEn: 'Zoom Video Communications, Inc.' },
    { ticker: 'DOCN', name: 'DigitalOcean Holdings, Inc.', nameEn: 'DigitalOcean Holdings, Inc.' },
    { ticker: 'SNOW', name: 'Snowflake Inc.', nameEn: 'Snowflake Inc.' },
    { ticker: 'DDOG', name: 'Datadog, Inc.', nameEn: 'Datadog, Inc.' },
    { ticker: 'CRWD', name: 'CrowdStrike Holdings, Inc.', nameEn: 'CrowdStrike Holdings, Inc.' },
    { ticker: 'NET', name: 'Cloudflare, Inc.', nameEn: 'Cloudflare, Inc.' },
    { ticker: 'PLTR', name: 'Palantir Technologies Inc.', nameEn: 'Palantir Technologies Inc.' },
    { ticker: 'RBLX', name: 'Roblox Corporation', nameEn: 'Roblox Corporation' },
    { ticker: 'COIN', name: 'Coinbase Global, Inc.', nameEn: 'Coinbase Global, Inc.' },
    { ticker: 'HOOD', name: 'Robinhood Markets, Inc.', nameEn: 'Robinhood Markets, Inc.' },
    { ticker: 'SOFI', name: 'SoFi Technologies, Inc.', nameEn: 'SoFi Technologies, Inc.' },
    { ticker: 'RIVN', name: 'Rivian Automotive, Inc.', nameEn: 'Rivian Automotive, Inc.' },
    { ticker: 'LCID', name: 'Lucid Group, Inc.', nameEn: 'Lucid Group, Inc.' },
    { ticker: 'F', name: 'Ford Motor Company', nameEn: 'Ford Motor Company' },
    { ticker: 'GM', name: 'General Motors Company', nameEn: 'General Motors Company' },
    { ticker: 'NIO', name: 'NIO Inc.', nameEn: 'NIO Inc.' },
    { ticker: 'XPEV', name: 'XPeng Inc.', nameEn: 'XPeng Inc.' },
    { ticker: 'LI', name: 'Li Auto Inc.', nameEn: 'Li Auto Inc.' },
];

// Lazy initialization of KIS API
let kisApi: any = null;
const getKISApi = () => {
    if (!kisApi) {
        // Use singleton factory to share access token
        const factory = KISApiFactory.getInstance();
        kisApi = factory.create();
    }
    return kisApi;
};

/**
 * Search for stocks by ticker or name
 */
export const searchStocks = async (req: Request, res: Response) => {
    try {
        const query = (req.query.query as string || '').toLowerCase().trim();
        const marketParam = (req.query.market as string || Market.DOMESTIC).toUpperCase();
        // Convert string to Market enum
        const market = Object.values(Market).find(m => m === marketParam) || Market.DOMESTIC;

        logger.info('Stock search request', { query, market });

        if (!query || query.length < 1) {
            return res.json({ success: true, data: [] });
        }

        // For Korean market, search in local database
        if (market === Market.DOMESTIC) {
            const results = KOREAN_STOCKS.filter(stock =>
                stock.ticker.includes(query) ||
                stock.name.toLowerCase().includes(query) ||
                stock.nameEn.toLowerCase().includes(query)
            ).slice(0, 20); // Limit to 20 results

            return res.json({
                success: true,
                data: results.map(stock => ({
                    ticker: stock.ticker,
                    name: stock.name,
                    nameEn: stock.nameEn,
                    market: 'DOMESTIC'
                }))
            });
        }

        // For US market, try KIS API first, then fallback to local database
        if (market === Market.US) {
            // First, try to search using KIS API if query looks like a ticker (uppercase, short)
            const isTickerLike = /^[A-Z]{1,5}(\.[A-Z])?$/.test(query.toUpperCase());
            
            if (isTickerLike) {
                try {
                    await kisRateLimiter.waitIfNeeded();
                    const kisResult = await getKISApi().searchOverseasStock(query.toUpperCase(), 'NAS');
                    
                    if (kisResult) {
                        return res.json({
                            success: true,
                            data: [{
                                ticker: kisResult.ticker,
                                name: kisResult.name,
                                nameEn: kisResult.nameEn,
                                market: 'US',
                                price: kisResult.price,
                                change_pct: kisResult.change_pct,
                            }]
                        });
                    }
                } catch (error) {
                    logger.warn('KIS API search failed, falling back to local database', { error, query });
                }
            }
            
            // Fallback to local database search
            const results = US_STOCKS.filter(stock =>
                stock.ticker.toLowerCase().includes(query) ||
                stock.name.toLowerCase().includes(query) ||
                stock.nameEn.toLowerCase().includes(query)
            ).slice(0, 20); // Limit to 20 results

            return res.json({
                success: true,
                data: results.map(stock => ({
                    ticker: stock.ticker,
                    name: stock.name,
                    nameEn: stock.nameEn,
                    market: 'US'
                }))
            });
        }

        // For other markets, return empty for now (can be extended)
        res.json({ success: true, data: [] });

    } catch (error) {
        logger.error('Failed to search stocks', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search stocks',
        });
    }
};

/**
 * Get popular/trending stocks by volume ranking
 */
export const getPopularStocks = async (req: Request, res: Response) => {
    try {
        const marketParam = (req.query.market as string || Market.DOMESTIC).toUpperCase();
        // Convert string to Market enum
        const market = Object.values(Market).find(m => m === marketParam) || Market.DOMESTIC;
        const limit = parseInt(req.query.limit as string || '30');

        logger.info('Get popular stocks request', { market, limit });

        if (market === Market.DOMESTIC) {
            // Return top stocks from local database
            // TODO: Integrate with KIS API volume ranking for real-time data
            const stocks = KOREAN_STOCKS.slice(0, Math.min(limit, KOREAN_STOCKS.length)).map(stock => ({
                ticker: stock.ticker,
                name: stock.name,
                nameEn: stock.nameEn,
                market: 'DOMESTIC'
            }));

            return res.json({ success: true, data: stocks });
        }

        if (market === Market.US) {
            // Try to get popular stocks from KIS API first
            try {
                await kisRateLimiter.waitIfNeeded();
                const kisData = await getKISApi().getOverseasPopularStocks('NAS');
                
                if (kisData.output && kisData.output.length > 0) {
                    const stocks = kisData.output.slice(0, limit).map((stock: any) => ({
                        ticker: stock.symbol || stock.SYMB,
                        name: stock.hts_kor_isnm || stock.ovrs_nm || stock.SYMB,
                        nameEn: stock.ovrs_nm || stock.hts_kor_isnm || stock.SYMB,
                        market: 'US',
                        price: parseFloat(stock.last || stock.LAST || 0),
                        change_pct: parseFloat(stock.rate || stock.RATE || 0),
                    }));
                    
                    return res.json({ success: true, data: stocks });
                }
            } catch (error) {
                logger.warn('KIS API popular stocks failed, falling back to local database', { error });
            }
            
            // Fallback to local database
            const stocks = US_STOCKS.slice(0, Math.min(limit, US_STOCKS.length)).map(stock => ({
                ticker: stock.ticker,
                name: stock.name,
                nameEn: stock.nameEn,
                market: 'US'
            }));

            return res.json({ success: true, data: stocks });
        }

        // For other markets, return empty
        res.json({ success: true, data: [] });

    } catch (error) {
        logger.error('Failed to get popular stocks', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get popular stocks',
        });
    }
};

/**
 * Get stock detail by ticker
 */
export const getStockDetail = async (req: Request, res: Response) => {
    try {
        const { ticker } = req.params;
        const marketParam = (req.query.market as string || Market.DOMESTIC).toUpperCase();
        // Convert string to Market enum
        const market = Object.values(Market).find(m => m === marketParam) || Market.DOMESTIC;

        logger.info('Get stock detail request', { ticker, market });

        if (market === Market.DOMESTIC) {
            // Try to find in local database first
            const localStock = KOREAN_STOCKS.find(s => s.ticker === ticker);

            // Get current price from KIS API
            await kisRateLimiter.waitIfNeeded();
            const priceData = await getKISApi().getCurrentPrice(ticker);
            const output = priceData.output || {};

            const stock = {
                ticker,
                name: localStock?.name || output.hts_kor_isnm || ticker,
                nameEn: localStock?.nameEn || '',
                price: parseFloat(output.stck_prpr || 0),
                change_pct: parseFloat(output.prdy_ctrt || 0),
                volume: parseFloat(output.acml_vol || 0),
                market: 'DOMESTIC'
            };

            return res.json({ success: true, data: stock });
        }

        res.json({ success: true, data: null });

    } catch (error) {
        logger.error('Failed to get stock detail', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get stock detail',
        });
    }
};
