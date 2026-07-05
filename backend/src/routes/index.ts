import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import marketRoutes from "./market.routes.js";
import portfolioRoutes from "./portfolio.routes.js";
import tradingRoutes from "./trading.routes.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/markets", marketRoutes);
router.use("/portfolio", portfolioRoutes);
router.use("/trading", tradingRoutes);

export default router;
