import { Router } from "express";
import { executeBuy, executeSell } from "../controllers/trading.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.post("/buy", executeBuy);
router.post("/sell", executeSell);

export default router;
