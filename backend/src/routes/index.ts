import { Router } from "express";
import portfoliosRoutes from "./portfolios.routes.js";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import marketRoutes from "./market.routes.js";
import settingsRoutes from "./settings.routes.js";
import watchlistRoutes from "./watchlist.routes.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/markets", marketRoutes);
router.use("/portfolios", portfoliosRoutes);
router.use("/watchlist", watchlistRoutes);
router.use("/settings", settingsRoutes);

export default router;
