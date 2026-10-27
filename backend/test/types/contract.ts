/**
 * Compile-time contract check: what the backend serialises must match the wire
 * types the frontend reads from @paper/shared. Typechecked by `npm run typecheck`;
 * never executed.
 */
import type * as Wire from "@paper/shared";
import type { Candle, MarketSummary, OrderBook, MarketTrade, Ticker } from "../../src/types/market.js";
import type { PortfolioDetail, Position, Trade } from "../../src/types/portfolio.js";

type Assert<T extends true> = T;
type Matches<Server, Client> = [Wire.Jsonify<Server>] extends [Client] ? true : false;

export type Contract = [
  Assert<Matches<Ticker, Wire.Ticker>>,
  Assert<Matches<MarketSummary, Wire.MarketSummary>>,
  Assert<Matches<OrderBook, Wire.OrderBook>>,
  Assert<Matches<MarketTrade, Wire.MarketTrade>>,
  Assert<Matches<Candle, Wire.Candle>>,
  Assert<Matches<Position, Wire.Position>>,
  Assert<Matches<Trade, Wire.Trade>>,
  Assert<Matches<PortfolioDetail, Wire.PortfolioDetail>>,
];
