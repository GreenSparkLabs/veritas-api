const express = require('express');
const { authenticate, optionalAuth, requireAdmin } = require('../middleware/auth');
const {
  getAllTipsters,
  getTipsterById,
  createTipster,
  updateTipster,
  deleteTipster,
  getTipsterStats
} = require('../controllers/tipsters');

const router = express.Router();

/**
 * @route GET /api/tipsters
 * @desc Get all tipsters with performance summaries
 * @access Public
 * @query page, limit, platform, type, sortBy, sortOrder
 */
router.get('/', optionalAuth, getAllTipsters);

/**
 * @route GET /api/tipsters/:tipsterId
 * @desc Get single tipster by ID with detailed performance data
 * @access Public
 */
router.get('/:tipsterId', optionalAuth, getTipsterById);

/**
 * @route GET /api/tipsters/:tipsterId/stats
 * @desc Get tipster statistics from tips database
 * @access Public
 */
router.get('/:tipsterId/stats', optionalAuth, getTipsterStats);

/**
 * @route POST /api/tipsters
 * @desc Create new tipster (admin only)
 * @access Private (Admin)
 */
router.post('/', authenticate, requireAdmin, createTipster);

/**
 * @route PUT /api/tipsters/:tipsterId
 * @desc Update tipster (admin only)
 * @access Private (Admin)
 */
router.put('/:tipsterId', authenticate, requireAdmin, updateTipster);

/**
 * @route DELETE /api/tipsters/:tipsterId
 * @desc Delete tipster (admin only)
 * @access Private (Admin)
 */
router.delete('/:tipsterId', authenticate, requireAdmin, deleteTipster);

module.exports = router;