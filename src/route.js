import express from "express";
import { getMetadata, handleStreaming } from "./controller.js";

const router = express.Router()

router.get('/health', (req, res) => {
  res.sendStatus(200)
})

router.post('/metadata', getMetadata)
router.get('/stream', handleStreaming)

export default router
