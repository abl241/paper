import { Router } from "express";
import {
  createStrategy,
  deleteStrategy,
  duplicateStrategy,
  getStrategy,
  listStrategies,
  listTemplates,
  updateStrategy,
  validateStrategy,
} from "../controllers/strategy.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.get("/templates", listTemplates);

router.use(authenticate);
router.get("/", listStrategies);
router.post("/", createStrategy);
router.get("/:strategyId", getStrategy);
router.patch("/:strategyId", updateStrategy);
router.post("/:strategyId/duplicate", duplicateStrategy);
router.post("/:strategyId/validate", validateStrategy);
router.delete("/:strategyId", deleteStrategy);

export default router;
