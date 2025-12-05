import { AxiosInstance } from 'axios';

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
        const response = await this.http.get('/uapi/domestic-stock/v1/trading/inquire-balance', {
            params: {
                CANO: accountNumber.substring(0, 8),
                ACNT_PRDT_CD: accountNumber.substring(8),
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
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-price', {
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
        const response = await this.http.get(
            '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice',
            {
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
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-daily-price', {
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
        const response = await this.http.get('/uapi/domestic-stock/v1/quotations/inquire-index-price', {
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
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/price', {
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
        period: string = 'D' // D=Daily, W=Weekly, M=Monthly
    ): Promise<any> {
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/dailyprice', {
            params: {
                AUTH: '',
                EXCD: exchangeCode,
                SYMB: ticker,
                GUBN: period,
                BYMD: '', // End date (empty = today)
                MODP: '1', // 0=unadjusted, 1=adjusted
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
        orderType: string = '00' // 00=Limit
    ): Promise<any> {
        const response = await this.http.post('/uapi/overseas-stock/v1/trading/order', {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            OVRS_EXCG_CD: exchangeCode,
            PDNO: ticker,
            ORD_QTY: quantity.toString(),
            OVRS_ORD_UNPR: price.toString(),
            ORD_SVR_DVSN_CD: '0', // 0=Buy
            ORD_DVSN: orderType,
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
        orderType: string = '00'
    ): Promise<any> {
        const response = await this.http.post('/uapi/overseas-stock/v1/trading/order', {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            OVRS_EXCG_CD: exchangeCode,
            PDNO: ticker,
            ORD_QTY: quantity.toString(),
            OVRS_ORD_UNPR: price.toString(),
            ORD_SVR_DVSN_CD: '1', // 1=Sell
            ORD_DVSN: orderType,
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
        const response = await this.http.get('/uapi/overseas-stock/v1/trading/inquire-ccld', {
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
        const response = await this.http.get('/uapi/overseas-price/v1/quotations/inquire-search', {
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
}

