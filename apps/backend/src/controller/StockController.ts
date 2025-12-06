import { Request, Response } from 'express';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
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

// Lazy initialization of KIS API
let kisApi: any = null;
const getKISApi = () => {
    if (!kisApi) {
        const factory = new KISApiFactory();
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
        const market = (req.query.market as string || 'DOMESTIC').toUpperCase();

        logger.info('Stock search request', { query, market });

        if (!query || query.length < 1) {
            return res.json({ success: true, data: [] });
        }

        // For Korean market, search in local database
        if (market === 'DOMESTIC') {
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
        const market = (req.query.market as string || 'DOMESTIC').toUpperCase();
        const limit = parseInt(req.query.limit as string || '30');

        logger.info('Get popular stocks request', { market, limit });

        if (market === 'DOMESTIC') {
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
        const market = (req.query.market as string || 'DOMESTIC').toUpperCase();

        logger.info('Get stock detail request', { ticker, market });

        if (market === 'DOMESTIC') {
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
