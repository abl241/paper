import { Router } from "express";
import {
  getCandles,
  getOrderBook,
  getSummaries,
  getTicker,
  getTrades,
  listSymbols,
} from "../controllers/market.controller.js";

const router = Router();

router.get("/symbols", listSymbols);
router.get("/summaries", getSummaries);
router.get("/ticker/:symbol", getTicker);
router.get("/orderbook/:symbol", getOrderBook);
router.get("/trades/:symbol", getTrades);
router.get("/candles/:symbol", getCandles);

export default router;
