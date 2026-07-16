import { Router } from "express";
import {
  adjustFunds,
  archivePortfolio,
  createPortfolio,
  executeBuy,
  executeSell,
  getPortfolioDetail,
  getPortfolioPerformance,
  getPortfolioTrades,
  listPortfolios,
  resetPortfolio,
  updatePortfolio,
} from "../controllers/portfolio.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/", listPortfolios);
router.post("/", createPortfolio);
router.get("/:id", getPortfolioDetail);
router.patch("/:id", updatePortfolio);
router.post("/:id/archive", archivePortfolio);
router.post("/:id/reset", resetPortfolio);
router.post("/:id/funds", adjustFunds);
router.get("/:id/trades", getPortfolioTrades);
router.get("/:id/performance", getPortfolioPerformance);
router.post("/:id/trading/buy", executeBuy);
router.post("/:id/trading/sell", executeSell);

export default router;
