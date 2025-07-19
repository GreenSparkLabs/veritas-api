const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Get all tips with filtering and pagination
const getAllTips = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sport,
      competition,
      tipster,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const maxLimit = Math.min(parseInt(limit), 100);

    // Build WHERE clause
    let whereClause = '';
    let whereParams = [];

    if (status) {
      whereClause += ` WHERE json_extract(doc, '$.status') = '${status}'`;

    }

    if (sport) {
      whereClause += whereClause
        ? ` AND json_extract(doc, '$.sport') = '${sport}'`
        : ` WHERE json_extract(doc, '$.sport') = '${sport}'`;
    }

    if (competition) {
      whereClause += whereClause
        ? ` AND json_extract(doc, '$.competition') LIKE '${competition}'`
        : ` WHERE json_extract(doc, '$.competition') LIKE '${competition}'`;
    }

    if (tipster) {
      whereClause += whereClause
        ? " AND json_extract(doc, '$.tipster_id') = ?"
        : " WHERE json_extract(doc, '$.tipster_id') = ?";
      whereParams.push(tipster);
    }

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM sports_betting_tips${whereClause}`,
    );
    const totalItems = countResult[0].total;

    // Get tips
    console.log(...whereParams, maxLimit, offset);
    const [tips] = await pool.execute(
      `SELECT * FROM sports_betting_tips${whereClause} ORDER BY _id DESC LIMIT ${maxLimit} OFFSET ${offset} `
    );

    tips.sort((a, b) => {
      return a["created_at"] - b["created_at"];
    });

    let tipsters = [];
    // Format response
    const formattedTips = await Promise.all(tips.map(async (t) => {
      const tip = t.doc
      let matchDetails = null
      if (tip.match_id && tip.match_collection) {
        const [matchList] = await pool.execute(
          `SELECT * FROM ${tip.match_collection} WHERE JSON_EXTRACT(doc, '$._id') = '${tip.match_id}'`,
        );
        if (matchList.length > 0)
        {
          matchDetails = matchList[0].doc
        }
      }
      const [tipsterList] = await pool.execute(
          `SELECT * FROM tipsters WHERE JSON_EXTRACT(doc, '$.url') = '${tip.source.tipster_url}'`,
        );
      const tipster = tipsterList[0]
      const source = tip.source
      return {
        _id: tip._id,
        source: {
          platform: source.platform,
          handle: source.handle, // Will be populated by join query if needed
          tipster_url: source.tipster_url,
          url: source.url,
          tipster: tipster.doc,
        },
        matchData: matchDetails,
        eventStartTime: tip.event_starttime,
        sport: tip.sport,
        home: tip.home,
        away: tip.away,
        competition: tip.competition,
        createdAt: tip.created_at,
        status: tip.status,
        selection: tip.selection,
        marketType: tip.market_type,
        odds: parseFloat(tip.actual_odds),
        stake_recommendation: {
          stake_type: tip.stake_recommendation.stake_type,
          amount: tip.stake_recommendation.amount,
        },

        resultData: tip.result_data ? tip.result_data : null,
      };
    }));

    const totalPages = Math.ceil(totalItems / maxLimit);

    res.json({
      success: true,
      data: formattedTips,
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
    console.error('Get tips error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Get single tip by ID
const getTipById = async (req, res) => {
  try {
    const { tipId } = req.params;

    // Get tip details
    const [tips] = await pool.execute(
      "SELECT * FROM tips WHERE json_extract(doc, '_id') = ?",
      [tipId]
    );

    if (tips.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tip not found',
        code: 'TIP_NOT_FOUND'
      });
    }

    const tip = tips[0];

    // Get match details
    let match = null;
    if (tip.match_id) {
      let fem_length = female_words.filter((word) => female_words.includes(word)).length;
      let gender_suffix = ""
      if (fem_length > 0){
        gender_suffix = "_womens"
      }

          
      const [matches] = await pool.execute(
        `SELECT * FROM ${tip.sport}_matches${gender_suffix} WHERE json_extract(doc, '$._id') = ?`,
        [tip.match_id]
      );
      
      if (matches.length > 0) {
        match = matches[0];
        
      }
    }

    // Get tipster details
    let tipster = null;
    if (tip.tipster_url) {
      const [tipsters] = await pool.execute(
        "SELECT * FROM tipsters WHERE json_extract(doc, '_id') = ?",
        [tip.tipster_id]
      );
      
      if (tipsters.length > 0) {
        const tipsterData = tipsters[0];
        tipster = {
          id: tipsterData.id,
          name: tipsterData.name,
          url: tipsterData.url,
          type: tipsterData.type,
          platform: tipsterData.platform,
          tracked: tipsterData.tracked ? tipsterData.tracked : null
        };
      }
    }

    // Format response
    const response = {
      tip: {
        id: tip.id,
        selection: tip.selection,
        marketType: tip.market_type,
        odds: parseFloat(tip.odds),
        stake: tip.stake,
        status: tip.status,
        sport: tip.sport,
        createdAt: tip.created_at,
        resultData: tip.result_data ? JSON.parse(tip.result_data) : null
      },
      match,
      tipster
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get tip by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Create new tip (admin only)
const createTip = async (req, res) => {
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
      home_team,
      away_team,
      selection,
      market_type,
      odds,
      stake,
      status = 'pending',
      sport,
      competition,
      match_id,
      tipster_id,
      source_platform,
      source_url,
      event_starttime,
      result_data
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO tips (
        id, home_team, away_team, selection, market_type, odds, stake, 
        status, sport, competition, match_id, tipster_id, source_platform, 
        source_url, event_starttime, result_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id || `tip_${Date.now()}`, home_team, away_team, selection, market_type, 
        odds, stake, status, sport, competition, match_id, tipster_id, 
        source_platform, source_url, event_starttime, 
        result_data ? JSON.stringify(result_data) : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Tip created successfully',
      tipId: id || `tip_${Date.now()}`
    });

  } catch (error) {
    console.error('Create tip error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Update tip (admin only)
const updateTip = async (req, res) => {
  try {
    const { tipId } = req.params;
    const updateData = req.body;

    // Build update query
    const allowedFields = [
      'home_team', 'away_team', 'selection', 'market_type', 'odds', 'stake',
      'status', 'sport', 'competition', 'match_id', 'tipster_id', 
      'source_platform', 'source_url', 'event_starttime', 'result_data'
    ];

    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(key === 'result_data' ? JSON.stringify(updateData[key]) : updateData[key]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        code: 'NO_VALID_FIELDS'
      });
    }

    values.push(tipId);

    const [result] = await pool.execute(
      `UPDATE tips SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tip not found',
        code: 'TIP_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Tip updated successfully'
    });

  } catch (error) {
    console.error('Update tip error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Delete tip (admin only)
const deleteTip = async (req, res) => {
  try {
    const { tipId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM tips WHERE id = ?',
      [tipId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tip not found',
        code: 'TIP_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Tip deleted successfully'
    });

  } catch (error) {
    console.error('Delete tip error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  getAllTips,
  getTipById,
};