export interface CoinbaseProduct {
  product_id: string;
  price?: string;
  volume_24h?: string;
  status?: string;
  trading_disabled?: boolean;
  product_type?: string;
  quote_currency_id?: string;
  base_currency_id?: string;
}

export interface CoinbaseProductsResponse {
  products: CoinbaseProduct[];
}

export interface CoinbaseTrade {
  trade_id: string;
  product_id: string;
  price: string;
  size: string;
  time: string;
  side: "BUY" | "SELL" | string;
}

export interface CoinbaseTickerResponse {
  trades: CoinbaseTrade[];
  best_bid: string;
  best_ask: string;
}

export interface CoinbaseBookLevel {
  price: string;
  size: string;
}

export interface CoinbaseProductBookResponse {
  pricebook: {
    product_id: string;
    bids: CoinbaseBookLevel[];
    asks: CoinbaseBookLevel[];
    time?: string;
  };
  last?: string;
}

export interface CoinbaseCandle {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
}

export interface CoinbaseCandlesResponse {
  candles: CoinbaseCandle[];
}
