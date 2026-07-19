import { Router } from "express";
import {
  createBacktest,
  getBacktest,
  listBacktests,
} from "../controllers/research.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/backtests", listBacktests);
router.post("/backtests", createBacktest);
router.get("/backtests/:backtestId", getBacktest);

export default router;
