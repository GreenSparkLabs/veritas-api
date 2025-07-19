const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getAllTips,
  getTipById,
} = require('../controllers/tips');

const router = express.Router();

/**
 * @route GET /api/tips
 * @desc Get all tips with filtering and pagination
 * @access Public
 * @query page, limit, status, sport, competition, tipster, sortBy, sortOrder
 */
router.get("/", authenticate, getAllTips);

/**
 * @route GET /api/tips/:tipId
 * @desc Get single tip by ID with match and tipster details
 * @access Public
 */
router.get("/:tipId", authenticate, getTipById);


module.exports = router;