import { Router } from "express";
import {
  getOrderBook,
  getTicker,
  getTrades,
  listSymbols,
} from "../controllers/market.controller.js";

const router = Router();

router.get("/symbols", listSymbols);
router.get("/ticker/:symbol", getTicker);
router.get("/orderbook/:symbol", getOrderBook);
router.get("/trades/:symbol", getTrades);

export default router;
