import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/", getSettings);
router.patch("/", updateSettings);

export default router;
