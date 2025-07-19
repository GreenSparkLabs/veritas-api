const express = require('express');
const { authenticate, optionalAuth, requireAdmin } = require('../middleware/auth');
const {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch
} = require('../controllers/matches');

const router = express.Router();

/**
 * @route GET /api/matches
 * @desc Get all matches with filtering and pagination
 * @access Public
 * @query page, limit, date, competition, team, status, sport, sortBy, sortOrder
 */
router.get('/', optionalAuth, getAllMatches);

/**
 * @route GET /api/matches/:matchId
 * @desc Get single match by ID with statistics and related tips
 * @access Public
 */
router.get('/:matchId', optionalAuth, getMatchById);


module.exports = router;