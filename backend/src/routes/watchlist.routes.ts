import { Router } from "express";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from "../controllers/watchlist.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/", getWatchlist);
router.post("/items", addWatchlistItem);
router.delete("/items/:symbol", removeWatchlistItem);

export default router;
