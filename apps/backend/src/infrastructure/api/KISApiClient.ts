import { AxiosInstance } from 'axios';
import { logger } from '../../util/logger';

/**
 * KIS API Client
 * Wrapper for Korea Investment & Securities Open API
 * 
 * API Documentation: https://apiportal.koreainvestment.com/
 */
export class KISApiClient {
    constructor(private readonly http: AxiosInstance) { }

    // ========================================
    // Account & Portfolio
    // ========================================

    /**
     * Get account balance and holdings
     * 주식잔고조회
     */
    async getAccountBalance(accountNumber: string): Promise<any> {
        // Remove hyphen if present: "50157719-01" -> "5015771901"
        const cleanAccountNumber = accountNumber.replace(/-/g, '');

        // TR_ID differs based on mode (paper vs live)
        const mode = process.env.MODE || 'paper';
        const trId = mode === 'live' ? 'TTTC8434R' : 'VTTC8434R';

        const response = await this.http.get('/uapi/domestic-stock/v1/trading/inquire-balance', {
            headers: {
                'tr_id': trId,
            },
            params: {
                CANO: cleanAccountNumber.substring(0, 8),
                ACNT_PRDT_CD: cleanAccountNumber.substring(8),
                AFHR_FLPR_YN: 'N',
                OFL_YN: '',
                INQR_DVSN: '02',
                UNPR_DVSN: '01',
                FUND_STTL_ICLD_YN: 'N',
                FNCG_AMT_AUTO_RDPT_YN: 'N',
                PRCS_DVSN: '01',
                CTX_AREA_FK100: '',
                CTX_AREA_NK100: '',
            },
        });
        return response.data;
    }

    /**
     * Get buyable quantity/amount for a stock
     * 매수가능조회
     */
    async getBuyableAmount(accountNumber: string, ticker: string, price: number): Promise<any> {
        const response = await this.http.get('/uapi/domestic-stock/v1/trading/inquire-psbl-order', {
            params: {
                CANO: accountNumber.substring(0, 8),
                ACNT_PRDT_CD: accountNumber.substring(8),
                PDNO: ticker,
                ORD_UNPR: price.toString(),
                ORD_DVSN: '00',
                CMA_EVLU_AMT_ICLD_YN: 'Y',
                OVRS_ICLD_YN: 'N',
            },
        });
        return response.data;
    }

    // ========================================
    // Market Data
    // ========================================

    /**
     * Get current price for a stock
     * 주식현재가 시세
     */
    async getCurrentPrice(ticker: string): Promise<any> {
        const mode = process.env.MODE || 'paper';
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-price', {
            headers: { 'tr_id': mode === 'live' ? 'FHKST01010100' : 'FHKST01010100' },
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: ticker,
            },
        });
        return response.data;
    }

    /**
     * Get intraday minute candles
     * 주식당일분봉조회
     */
    async getMinuteCandles(ticker: string, interval: number = 1): Promise<any> {
        const mode = process.env.MODE || 'paper';
        const response = await this.http.get(
            '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice',
            {
                headers: { 'tr_id': mode === 'live' ? 'FHKST03010200' : 'FHKST03010200' },
                params: {
                    FID_ETC_CLS_CODE: '',
                    FID_COND_MRKT_DIV_CODE: 'J',
                    FID_INPUT_ISCD: ticker,
                    FID_INPUT_HOUR_1: '',
                    FID_PW_DATA_INCU_YN: 'Y',
                },
            }
        );
        return response.data;
    }

    /**
     * Get daily OHLCV data
     * 국내주식기간별시세(일/주/월/년)
     */
    async getDailyPrices(ticker: string, startDate: string, endDate: string): Promise<any> {
        const mode = process.env.MODE || 'paper';
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
            headers: { 'tr_id': mode === 'live' ? 'FHKST03010100' : 'FHKST03010100' },
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: ticker,
                FID_INPUT_DATE_1: startDate,
                FID_INPUT_DATE_2: endDate,
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0',
            },
        });
        return response.data;
    }

    /**
     * Get volume ranking
     * 거래량순위
     */
    async getVolumeRanking(limit: number = 50): Promise<any> {
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/volume-rank', {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20171',
                FID_INPUT_ISCD: '0000',
                FID_DIV_CLS_CODE: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_TRGT_CLS_CODE: '111111111',
                FID_TRGT_EXLS_CLS_CODE: '000000',
                FID_INPUT_PRICE_1: '',
                FID_INPUT_PRICE_2: '',
                FID_VOL_CNT: '',
                FID_INPUT_DATE_1: '',
            },
        });
        return response.data;
    }

    /**
     * Get price change ranking
     * 등락률 순위
     */
    async getChangeRateRanking(limit: number = 50): Promise<any> {
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20170',
                FID_INPUT_ISCD: '0000',
                FID_DIV_CLS_CODE: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_TRGT_CLS_CODE: '111111111',
                FID_TRGT_EXLS_CLS_CODE: '000000',
                FID_INPUT_PRICE_1: '',
                FID_INPUT_PRICE_2: '',
                FID_VOL_CNT: '',
                FID_INPUT_DATE_1: '',
            },
        });
        return response.data;
    }

    /**
     * Get index info (KOSPI, KOSDAQ)
     * 국내업종 현재지수
     */
    async getIndexInfo(indexCode: string = '0001'): Promise<any> {
        const mode = process.env.MODE || 'paper';
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
            headers: { 'tr_id': mode === 'live' ? 'FHKUP03500100' : 'FHKUP03500100' },
            params: {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_INPUT_ISCD: indexCode,
            },
        });
        return response.data;
    }

    // ========================================
    // Investor Trends
    // ========================================

    /**
     * Get investor trading trends by stock
     * 종목별 투자자매매동향
     */
    async getInvestorTrends(ticker: string): Promise<any> {
        const response = await this.http.get(
            '/uapi/domestic-stock/v1/quotations/inquire-investor-daily',
            {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J',
                    FID_INPUT_ISCD: ticker,
                    FID_INPUT_DATE_1: '',
                    FID_INPUT_DATE_2: '',
                    FID_PERIOD_DIV_CODE: 'D',
                },
            }
        );
        return response.data;
    }

    // ========================================
    // Order Execution
    // ========================================

    /**
     * Place a buy order (cash)
     * 주식 매수 주문
     */
    async buyOrder(
        accountNumber: string,
        ticker: string,
        quantity: number,
        price: number = 0,
        orderType: string = '01' // 00=market, 01=limit
    ): Promise<any> {
        const response = await this.http.post('/uapi/domestic-stock/v1/trading/order-cash', {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            PDNO: ticker,
            ORD_DVSN: orderType,
            ORD_QTY: quantity.toString(),
            ORD_UNPR: price.toString(),
        });
        return response.data;
    }

    /**
     * Place a sell order (cash)
     * 주식 매도 주문
     */
    async sellOrder(
        accountNumber: string,
        ticker: string,
        quantity: number,
        price: number = 0,
        orderType: string = '01'
    ): Promise<any> {
        const response = await this.http.post('/uapi/domestic-stock/v1/trading/order-cash', {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            PDNO: ticker,
            ORD_DVSN: orderType,
            ORD_QTY: quantity.toString(),
            ORD_UNPR: price.toString(),
            SLL_TYPE: '01', // Sell flag
        });
        return response.data;
    }

    /**
     * Cancel an order
     * 주식 주문 취소
     */
    async cancelOrder(
        accountNumber: string,
        originalOrderNumber: string,
        quantity: number
    ): Promise<any> {
        const response = await this.http.post('/uapi/domestic-stock/v1/trading/order-cancel', {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            KRX_FWDG_ORD_ORGNO: '',
            ORGN_ODNO: originalOrderNumber,
            ORD_DVSN: '00',
            RVSE_CNCL_DVSN_CD: '02',
            ORD_QTY: quantity.toString(),
            ORD_UNPR: '0',
            QTY_ALL_ORD_YN: 'Y',
        });
        return response.data;
    }

    /**
     * Get order/fill history for today
     * 주식 일별 주문체결 조회
     */
    async getOrderHistory(accountNumber: string, date: string): Promise<any> {
        const response = await this.http.get(
            '/uapi/domestic-stock/v1/trading/inquire-daily-ccld',
            {
                params: {
                    CANO: accountNumber.substring(0, 8),
                    ACNT_PRDT_CD: accountNumber.substring(8),
                    INQR_STRT_DT: date,
                    INQR_END_DT: date,
                    SLL_BUY_DVSN_CD: '00',
                    INQR_DVSN: '00',
                    PDNO: '',
                    CCLD_DVSN: '00',
                    ORD_GNO_BRNO: '',
                    ODNO: '',
                    INQR_DVSN_3: '00',
                    INQR_DVSN_1: '',
                    CTX_AREA_FK100: '',
                    CTX_AREA_NK100: '',
                },
            }
        );
        return response.data;
    }

    // ========================================
    // Overseas Stock Trading
    // ========================================

    /**
     * Get overseas account balance (multi-currency)
     * 해외주식 잔고조회
     */
    async getOverseasAccountBalance(accountNumber: string, exchangeCode: string = 'NAS'): Promise<any> {
        const response = await this.http.get('/uapi/overseas-stock/v1/trading/inquire-balance', {
            params: {
                CANO: accountNumber.substring(0, 8),
                ACNT_PRDT_CD: accountNumber.substring(8),
                OVRS_EXCG_CD: exchangeCode, // NAS, NYS, HKS, TSE, SHS
                TR_CRCY_CD: '', // Auto-detect
                CTX_AREA_FK200: '',
                CTX_AREA_NK200: '',
            },
        });
        return response.data;
    }

    /**
     * Get overseas stock current price
     * 해외주식 현재가
     */
    async getOverseasPrice(ticker: string, exchangeCode: string = 'NAS'): Promise<any> {
        const mode = process.env.MODE || 'paper';
        // tr_id: HHDFS00000300 (모의투자), HHDFS76950200 (실거래)
        const trId = mode === 'live' ? 'HHDFS76950200' : 'HHDFS00000300';
        
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/price', {
            headers: { 'tr_id': trId },
            params: {
                AUTH: '',
                EXCD: exchangeCode,
                SYMB: ticker,
            },
        });
        return response.data;
    }

    /**
     * Get overseas stock daily prices
     * 해외주식 기간별시세
     */
    async getOverseasDailyPrices(
        ticker: string,
        exchangeCode: string = 'NAS',
        period: string = 'D', // D=Daily, W=Weekly, M=Monthly
        startDate?: string,
        endDate?: string
    ): Promise<any> {
        const mode = process.env.MODE || 'paper';
        // tr_id: HHDFS00000300 (모의투자), HHDFS76950200 (실거래)
        const trId = mode === 'live' ? 'HHDFS76950200' : 'HHDFS00000300';
        
        // Format dates: YYYYMMDD
        const endDateFormatted = endDate ? endDate.replace(/-/g, '') : '';
        const startDateFormatted = startDate ? startDate.replace(/-/g, '') : '';
        
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/dailyprice', {
            headers: { 'tr_id': trId },
            params: {
                AUTH: '',
                EXCD: exchangeCode,
                SYMB: ticker,
                GUBN: period,
                BYMD: endDateFormatted, // End date (YYYYMMDD format)
                MODP: '1', // 0=unadjusted, 1=adjusted
                ...(startDateFormatted && { FRMD: startDateFormatted }), // Start date if provided
            },
        });
        return response.data;
    }

    /**
     * Get exchange rates
     * 환율 조회
     */
    async getExchangeRate(currencyCode: string = 'USD'): Promise<any> {
        const response = await this.http.get('/uapi/overseas-stock/v1/trading/inquire-present-balance', {
            params: {
                CANO: '',
                ACNT_PRDT_CD: '',
                OVRS_EXCG_CD: '',
                CRCY_CD: currencyCode, // USD, HKD, JPY, CNY
            },
        });
        return response.data;
    }

    /**
     * Place overseas buy order
     * 해외주식 매수 주문
     */
    async buyOverseasOrder(
        accountNumber: string,
        ticker: string,
        quantity: number,
        price: number,
        exchangeCode: string = 'NAS',
        orderType: string = '00' // 00=Limit (모의투자는 지정가만 가능)
    ): Promise<any> {
        const mode = process.env.MODE || 'paper';
        
        // Parse account number: format is "50157719-01" or "5015771901"
        const cleanAccountNumber = accountNumber.replace(/-/g, '');
        const cano = cleanAccountNumber.substring(0, 8);
        const acntPrdtCd = cleanAccountNumber.substring(8) || '01';
        
        // Determine TR_ID and exchange code based on market
        // 모의투자: VTTT1002U (미국 매수), VTTT1001U (미국 매도)
        // 실전: TTTT1002U (미국 매수), TTTT1006U (미국 매도)
        let trId: string;
        let finalExchangeCode: string;
        
        if (exchangeCode === 'NAS' || exchangeCode === 'NYSE' || exchangeCode === 'AMEX') {
            // 미국 주식
            trId = mode === 'live' ? 'TTTT1002U' : 'VTTT1002U';
            finalExchangeCode = exchangeCode === 'NAS' ? 'NASD' : exchangeCode === 'NYSE' ? 'NYSE' : 'AMEX';
        } else if (exchangeCode === 'HKS') {
            // 홍콩 주식
            trId = mode === 'live' ? 'TTTS1002U' : 'VTTS1002U';
            finalExchangeCode = 'SEHK';
        } else if (exchangeCode === 'TSE') {
            // 일본 주식
            trId = mode === 'live' ? 'TTTS0308U' : 'VTTS0308U';
            finalExchangeCode = 'TKSE';
        } else if (exchangeCode === 'SHS') {
            // 중국 상해 주식
            trId = mode === 'live' ? 'TTTS0202U' : 'VTTS0202U';
            finalExchangeCode = 'SHAA';
        } else {
            // 기본값: 미국 나스닥
            trId = mode === 'live' ? 'TTTT1002U' : 'VTTT1002U';
            finalExchangeCode = 'NASD';
        }
        
        // 모의투자는 지정가(00)만 가능, 시장가는 지원 안됨
        // 지정가 주문의 경우 현재 가격을 사용
        const orderPrice = price > 0 ? price.toString() : '0';
        
        const response = await this.http.post('/uapi/overseas-stock/v1/trading/order', {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            OVRS_EXCG_CD: finalExchangeCode,
            PDNO: ticker,
            ORD_QTY: quantity.toString(),
            OVRS_ORD_UNPR: orderPrice, // 시장가의 경우 "0", 지정가는 가격 입력
            ORD_SVR_DVSN_CD: '0', // 0=Buy
            ORD_DVSN: '00', // 모의투자는 지정가(00)만 가능
        }, {
            headers: { 'tr_id': trId },
        });
        return response.data;
    }

    /**
     * Place overseas sell order
     * 해외주식 매도 주문
     */
    async sellOverseasOrder(
        accountNumber: string,
        ticker: string,
        quantity: number,
        price: number,
        exchangeCode: string = 'NAS',
        orderType: string = '00' // 00=Limit (모의투자는 지정가만 가능)
    ): Promise<any> {
        const mode = process.env.MODE || 'paper';
        
        // Parse account number: format is "50157719-01" or "5015771901"
        const cleanAccountNumber = accountNumber.replace(/-/g, '');
        const cano = cleanAccountNumber.substring(0, 8);
        const acntPrdtCd = cleanAccountNumber.substring(8) || '01';
        
        // Determine TR_ID and exchange code based on market
        // 모의투자: VTTT1002U (미국 매수), VTTT1001U (미국 매도)
        // 실전: TTTT1002U (미국 매수), TTTT1006U (미국 매도)
        let trId: string;
        let finalExchangeCode: string;
        
        if (exchangeCode === 'NAS' || exchangeCode === 'NYSE' || exchangeCode === 'AMEX') {
            // 미국 주식
            trId = mode === 'live' ? 'TTTT1006U' : 'VTTT1001U';
            finalExchangeCode = exchangeCode === 'NAS' ? 'NASD' : exchangeCode === 'NYSE' ? 'NYSE' : 'AMEX';
        } else if (exchangeCode === 'HKS') {
            // 홍콩 주식
            trId = mode === 'live' ? 'TTTS1001U' : 'VTTS1001U';
            finalExchangeCode = 'SEHK';
        } else if (exchangeCode === 'TSE') {
            // 일본 주식
            trId = mode === 'live' ? 'TTTS0307U' : 'VTTS0307U';
            finalExchangeCode = 'TKSE';
        } else if (exchangeCode === 'SHS') {
            // 중국 상해 주식
            trId = mode === 'live' ? 'TTTS1005U' : 'VTTS1005U';
            finalExchangeCode = 'SHAA';
        } else {
            // 기본값: 미국 나스닥
            trId = mode === 'live' ? 'TTTT1006U' : 'VTTT1001U';
            finalExchangeCode = 'NASD';
        }
        
        // 모의투자는 지정가(00)만 가능, 시장가는 지원 안됨
        // 지정가 주문의 경우 현재 가격을 사용
        const orderPrice = price > 0 ? price.toString() : '0';
        
        const response = await this.http.post('/uapi/overseas-stock/v1/trading/order', {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            OVRS_EXCG_CD: finalExchangeCode,
            PDNO: ticker,
            ORD_QTY: quantity.toString(),
            OVRS_ORD_UNPR: orderPrice, // 시장가의 경우 "0", 지정가는 가격 입력
            ORD_SVR_DVSN_CD: '0', // 0=Buy (매도도 동일)
            ORD_DVSN: '00', // 모의투자는 지정가(00)만 가능
            SLL_TYPE: '00', // 00=매도
        }, {
            headers: { 'tr_id': trId },
        });
        return response.data;
    }

    /**
     * Get overseas order history
     * 해외주식 주문체결조회
     */
    async getOverseasOrderHistory(
        accountNumber: string,
        exchangeCode: string = 'NAS',
        startDate: string,
        endDate: string
    ): Promise<any> {
        const mode = process.env.MODE || 'paper';
        // tr_id: HHDFS00000300 (모의투자), HHDFS76950200 (실거래)
        const trId = mode === 'live' ? 'HHDFS76950200' : 'HHDFS00000300';
        
        const response = await this.http.get('/uapi/overseas-stock/v1/trading/inquire-ccld', {
            headers: { 'tr_id': trId },
            params: {
                CANO: accountNumber.substring(0, 8),
                ACNT_PRDT_CD: accountNumber.substring(8),
                OVRS_EXCG_CD: exchangeCode,
                SORT_SQN: 'DS', // Descending
                CTX_AREA_FK200: '',
                CTX_AREA_NK200: '',
                INQR_STRT_DT: startDate,
                INQR_END_DT: endDate,
            },
        });
        return response.data;
    }

    /**
     * Get popular overseas stocks
     * 해외주식 인기종목
     */
    async getOverseasPopularStocks(exchangeCode: string = 'NAS'): Promise<any> {
        const mode = process.env.MODE || 'paper';
        // tr_id: HHDFS00000300 (모의투자), HHDFS76950200 (실거래)
        const trId = mode === 'live' ? 'HHDFS76950200' : 'HHDFS00000300';
        
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/inquire-search', {
            headers: { 'tr_id': trId },
            params: {
                AUTH: '',
                EXCD: exchangeCode,
                CO_YN_PRICECUR: '',
                CO_ST_PRICECUR: '',
                CO_EN_PRICECUR: '',
                CO_YN_RATE: '',
                CO_ST_RATE: '',
                CO_EN_RATE: '',
                CO_YN_PER: '',
                CO_ST_PER: '',
                CO_EN_PER: '',
                CO_YN_VOL: '',
                CO_ST_VOL: '',
                CO_EN_VOL: '',
                CO_YN_AMT: '',
                CO_ST_AMT: '',
                CO_EN_AMT: '',
            },
        });
        return response.data;
    }

    /**
     * Search overseas stocks by ticker or name
     * 해외주식 종목검색
     * Note: KIS API doesn't have a direct search endpoint, so we try to get price for the ticker
     * and return the stock info if found
     */
    async searchOverseasStock(query: string, exchangeCode: string = 'NAS'): Promise<any> {
        try {
            // Try to get price for the ticker (assuming query is a ticker)
            const priceData = await this.getOverseasPrice(query, exchangeCode);
            
            if (priceData.output && priceData.output.length > 0) {
                const stock = priceData.output[0];
                return {
                    ticker: stock.symbol || query,
                    name: stock.hts_kor_isnm || stock.ovrs_nm || query,
                    nameEn: stock.ovrs_nm || stock.hts_kor_isnm || query,
                    market: 'US',
                    price: parseFloat(stock.last || 0),
                    change_pct: parseFloat(stock.rate || 0),
                };
            }
            
            return null;
        } catch (error) {
            // If ticker lookup fails, return null
            return null;
        }
    }
}

