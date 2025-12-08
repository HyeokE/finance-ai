/**
 * Sector and Industry mapping for stocks
 */

export interface SectorInfo {
  sector: string;
  industry: string;
}

export const SECTOR_MAP: Record<string, SectorInfo> = {
  // US Tech Giants
  AAPL: { sector: "Information Technology", industry: "Consumer Electronics" },
  MSFT: { sector: "Information Technology", industry: "Software" },
  GOOGL: { sector: "Communication Services", industry: "Internet Content" },
  GOOG: { sector: "Communication Services", industry: "Internet Content" },
  AMZN: { sector: "Consumer Discretionary", industry: "Internet Retail" },
  META: { sector: "Communication Services", industry: "Social Media" },
  TSLA: { sector: "Consumer Discretionary", industry: "Automobiles" },
  NVDA: { sector: "Information Technology", industry: "Semiconductors" },
  AMD: { sector: "Information Technology", industry: "Semiconductors" },
  INTC: { sector: "Information Technology", industry: "Semiconductors" },
  
  // US Finance
  JPM: { sector: "Financials", industry: "Banks" },
  BAC: { sector: "Financials", industry: "Banks" },
  WFC: { sector: "Financials", industry: "Banks" },
  GS: { sector: "Financials", industry: "Investment Banking" },
  MS: { sector: "Financials", industry: "Investment Banking" },
  V: { sector: "Financials", industry: "Payment Processing" },
  MA: { sector: "Financials", industry: "Payment Processing" },
  
  // US Healthcare
  JNJ: { sector: "Healthcare", industry: "Pharmaceuticals" },
  PFE: { sector: "Healthcare", industry: "Pharmaceuticals" },
  UNH: { sector: "Healthcare", industry: "Health Insurance" },
  ABBV: { sector: "Healthcare", industry: "Biotechnology" },
  
  // US Energy
  XOM: { sector: "Energy", industry: "Oil & Gas" },
  CVX: { sector: "Energy", industry: "Oil & Gas" },
  
  // US Consumer
  WMT: { sector: "Consumer Staples", industry: "Discount Stores" },
  PG: { sector: "Consumer Staples", industry: "Household Products" },
  KO: { sector: "Consumer Staples", industry: "Beverages" },
  PEP: { sector: "Consumer Staples", industry: "Beverages" },
  NKE: { sector: "Consumer Discretionary", industry: "Footwear" },
  MCD: { sector: "Consumer Discretionary", industry: "Restaurants" },
  SBUX: { sector: "Consumer Discretionary", industry: "Restaurants" },
  
  // Korean Tech
  "005930": { sector: "Information Technology", industry: "Semiconductors" }, // Samsung Electronics
  "000660": { sector: "Information Technology", industry: "Semiconductors" }, // SK Hynix
  "035420": { sector: "Information Technology", industry: "Internet Services" }, // NAVER
  "035720": { sector: "Communication Services", industry: "Internet Services" }, // Kakao
  
  // Korean Auto
  "005380": { sector: "Consumer Discretionary", industry: "Automobiles" }, // Hyundai Motor
  "000270": { sector: "Consumer Discretionary", industry: "Automobiles" }, // Kia
  
  // Korean Finance
  "055550": { sector: "Financials", industry: "Banks" }, // Shinhan Financial
  "086790": { sector: "Financials", industry: "Banks" }, // Hana Financial
  "105560": { sector: "Financials", industry: "Banks" }, // KB Financial
  
  // Korean Chemicals
  "051910": { sector: "Materials", industry: "Chemicals" }, // LG Chem
  "096770": { sector: "Materials", industry: "Chemicals" }, // SK Innovation
  
  // Korean Entertainment
  "035900": { sector: "Communication Services", industry: "Entertainment" }, // JYP Entertainment
  "041510": { sector: "Communication Services", industry: "Entertainment" }, // SM Entertainment
  "122870": { sector: "Communication Services", industry: "Entertainment" }, // YG Entertainment
  
  // Korean Retail
  "069960": { sector: "Consumer Discretionary", industry: "Retail" }, // Hyundai Department Store
  "139480": { sector: "Consumer Discretionary", industry: "E-commerce" }, // Coupang
  
  // Korean Bio/Pharma
  "207940": { sector: "Healthcare", industry: "Biotechnology" }, // Samsung Biologics
  "068270": { sector: "Healthcare", industry: "Pharmaceuticals" }, // Celltrion
  "326030": { sector: "Healthcare", industry: "Biotechnology" }, // SK Biopharmaceuticals
  
  // Korean Energy
  "015760": { sector: "Energy", industry: "Oil & Gas" }, // Korea Electric Power
  "010950": { sector: "Utilities", industry: "Electric Utilities" }, // S-Oil
};

export function getSectorInfo(ticker: string): SectorInfo {
  return (
    SECTOR_MAP[ticker] || {
      sector: "Unknown",
      industry: "Unknown",
    }
  );
}

