import { Router } from "express";
import { getPortfolio } from "../controllers/portfolio.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/", getPortfolio);

export default router;
