const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Get all tipsters with filtering and pagination
const getAllTipsters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      platform,
      type,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const maxLimit = Math.min(parseInt(limit), 100);

    // Build WHERE clause
    let whereClause = '';
    let whereParams = [];

    if (platform) {
      whereClause += ' WHERE platform = ?';
      whereParams.push(platform);
    }

    if (type) {
      whereClause += whereClause ? ' AND type = ?' : ' WHERE type = ?';
      whereParams.push(type);
    }

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM tipsters${whereClause}`,
      whereParams
    );
    const totalItems = countResult[0].total;

    // Get tipsters
    const [tipsters] = await pool.execute(
      `SELECT * FROM tipsters${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...whereParams, maxLimit, offset]
    );

    // Format response with summary stats
    const formattedTipsters = tipsters.map(tipster => {
      const trackedData = tipster.tracked_data ? JSON.parse(tipster.tracked_data) : null;
      
      // Calculate summary from tracked data
      let summary = {
        totalTips: 0,
        winRate: 0,
        profit: 0,
        roi: 0,
        activeMonths: 0,
        pendingTips: 0
      };

      if (trackedData) {
        const oneMonthData = trackedData['1_months'];
        if (oneMonthData) {
          summary = {
            totalTips: oneMonthData.number_of_tips || 0,
            winRate: oneMonthData.sport_data?.[0]?.win_ratio ? 
              (oneMonthData.sport_data[0].win_ratio * 100).toFixed(1) : 0,
            profit: oneMonthData.profit || 0,
            roi: oneMonthData.yield_percentage || 0,
            activeMonths: trackedData.active_months || 0,
            pendingTips: trackedData.pending_tips || 0
          };
        }
      }

      return {
        id: tipster.id,
        name: tipster.name,
        url: tipster.url,
        type: tipster.type,
        platform: tipster.platform,
        summary,
        lastUpdated: tipster.updated_at
      };
    });

    const totalPages = Math.ceil(totalItems / maxLimit);

    res.json({
      success: true,
      data: formattedTipsters,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        hasNext: parseInt(page) < totalPages,
        hasPrevious: parseInt(page) > 1,
        limit: maxLimit
      }
    });

  } catch (error) {
    console.error('Get tipsters error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Get single tipster by ID
const getTipsterById = async (req, res) => {
  try {
    const { tipsterId } = req.params;

    const [tipsters] = await pool.execute(
      'SELECT * FROM tipsters WHERE id = ?',
      [tipsterId]
    );

    if (tipsters.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tipster not found',
        code: 'TIPSTER_NOT_FOUND'
      });
    }

    const tipster = tipsters[0];

    // Get related tips
    const [tips] = await pool.execute(
      'SELECT id, selection, market_type, odds, status, created_at, home_team, away_team, competition FROM tips WHERE tipster_id = ? ORDER BY created_at DESC LIMIT 50',
      [tipsterId]
    );

    const trackedData = tipster.tracked_data ? JSON.parse(tipster.tracked_data) : null;

    // Format performance data
    let performance = {};
    if (trackedData) {
      const periods = ['1_months', '3_months', '12_months', 'last_10s'];
      periods.forEach(period => {
        if (trackedData[period]) {
          performance[period] = {
            profit: trackedData[period].profit || 0,
            numberOfTips: trackedData[period].number_of_tips || 0,
            unitsInvested: trackedData[period].units_invested || 0,
            yieldPercentage: trackedData[period].yield_percentage || 0,
            winRatio: trackedData[period].sport_data?.[0]?.win_ratio || 0,
            sportBreakdown: trackedData[period].sport_data || [],
            categoryBreakdown: trackedData[period].category_data || []
          };
        }
      });

      // Add last 10 results if available
      if (trackedData.last_10_results_array) {
        performance.last10Results = trackedData.last_10_results_array;
      }
    }

    const response = {
      id: tipster.id,
      name: tipster.name,
      url: tipster.url,
      type: tipster.type,
      platform: tipster.platform,
      performance,
      currentStatus: {
        pendingTips: trackedData?.pending_tips || 0,
        activeMonths: trackedData?.active_months || 0,
        lastActivity: tipster.updated_at
      },
      recentTips: tips.map(tip => ({
        id: tip.id,
        selection: tip.selection,
        marketType: tip.market_type,
        odds: parseFloat(tip.odds),
        status: tip.status,
        match: {
          home: tip.home_team,
          away: tip.away_team,
          competition: tip.competition
        },
        createdAt: tip.created_at
      })),
      createdAt: tipster.created_at,
      updatedAt: tipster.updated_at
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get tipster by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Create new tipster (admin only)
const createTipster = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      id,
      name,
      url,
      type,
      platform,
      tracked_data
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO tipsters (id, name, url, type, platform, tracked_data) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id || `tipster_${Date.now()}`,
        name,
        url,
        type,
        platform,
        tracked_data ? JSON.stringify(tracked_data) : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Tipster created successfully',
      tipsterId: id || `tipster_${Date.now()}`
    });

  } catch (error) {
    console.error('Create tipster error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Update tipster (admin only)
const updateTipster = async (req, res) => {
  try {
    const { tipsterId } = req.params;
    const updateData = req.body;

    // Build update query
    const allowedFields = ['name', 'url', 'type', 'platform', 'tracked_data'];
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'tracked_data') {
          values.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          values.push(updateData[key]);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        code: 'NO_VALID_FIELDS'
      });
    }

    values.push(tipsterId);

    const [result] = await pool.execute(
      `UPDATE tipsters SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tipster not found',
        code: 'TIPSTER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Tipster updated successfully'
    });

  } catch (error) {
    console.error('Update tipster error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Delete tipster (admin only)
const deleteTipster = async (req, res) => {
  try {
    const { tipsterId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM tipsters WHERE id = ?',
      [tipsterId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tipster not found',
        code: 'TIPSTER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Tipster deleted successfully'
    });

  } catch (error) {
    console.error('Delete tipster error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Get tipster statistics
const getTipsterStats = async (req, res) => {
  try {
    const { tipsterId } = req.params;

    // Get tipster
    const [tipsters] = await pool.execute(
      'SELECT * FROM tipsters WHERE id = ?',
      [tipsterId]
    );

    if (tipsters.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tipster not found',
        code: 'TIPSTER_NOT_FOUND'
      });
    }

    // Get tip statistics
    const [tipStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tips,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_tips,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_tips,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tips,
        AVG(odds) as avg_odds,
        MAX(odds) as max_odds,
        MIN(odds) as min_odds
      FROM tips WHERE tipster_id = ?
    `, [tipsterId]);

    const stats = tipStats[0];
    const winRate = stats.total_tips > 0 ? ((stats.won_tips / stats.total_tips) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        tipsterId,
        totalTips: stats.total_tips,
        wonTips: stats.won_tips,
        lostTips: stats.lost_tips,
        pendingTips: stats.pending_tips,
        winRate: parseFloat(winRate),
        averageOdds: stats.avg_odds ? parseFloat(stats.avg_odds).toFixed(2) : 0,
        maxOdds: stats.max_odds ? parseFloat(stats.max_odds) : 0,
        minOdds: stats.min_odds ? parseFloat(stats.min_odds) : 0
      }
    });

  } catch (error) {
    console.error('Get tipster stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  getAllTipsters,
  getTipsterById,
  createTipster,
  updateTipster,
  deleteTipster,
  getTipsterStats
};