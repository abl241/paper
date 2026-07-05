import { Router } from "express";
import healthRoutes from "./health.routes.js";
import marketRoutes from "./market.routes.js";

const router = Router();

router.use(healthRoutes);
router.use("/markets", marketRoutes);

export default router;
