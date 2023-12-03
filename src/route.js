import express from "express";
import {
  generateShortLink,
  getMetadata,
  handleStreaming,
  searchTorrents,
  handleShortService,
  handleShortStats
} from "./controller.js";

const router = express.Router();

router.get('/health', (res) => {
  res.sendStatus(200)
});

router.get('/metadata', getMetadata);
router.get('/stream', handleStreaming);
router.get('/search', searchTorrents);
router.get('/generate/short', generateShortLink);
router.get('/short/:uid', handleShortService);
router.get('/short/stats/:uid', handleShortStats);

export default router;
