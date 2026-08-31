import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";

const router = Router();

router.get("/health", (req, res, next) => {
  void healthCheck(req, res).catch(next);
});

export default router;
