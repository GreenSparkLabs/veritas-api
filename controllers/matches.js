const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Get all matches with filtering and pagination
const getAllMatches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      date,
      competition,
      team,
      status,
      sport,
      sortBy = 'match_date',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const maxLimit = Math.min(parseInt(limit), 100);

    // Build WHERE clause
    let whereClause = '';
    let whereParams = [];

    if (date) {
      whereClause += ' WHERE match_date = ?';
      whereParams.push(date);
    }

    if (competition) {
      whereClause += whereClause ? ' AND competition_name LIKE ?' : ' WHERE competition_name LIKE ?';
      whereParams.push(`%${competition}%`);
    }

    if (team) {
      whereClause += whereClause ? ' AND (home_team_name LIKE ? OR away_team_name LIKE ?)' : ' WHERE (home_team_name LIKE ? OR away_team_name LIKE ?)';
      whereParams.push(`%${team}%`, `%${team}%`);
    }

    if (status) {
      whereClause += whereClause ? ' AND status_stage = ?' : ' WHERE status_stage = ?';
      whereParams.push(status);
    }

    if (sport) {
      whereClause += whereClause ? ' AND sport = ?' : ' WHERE sport = ?';
      whereParams.push(sport);
    }

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM matches${whereClause}`,
      whereParams
    );
    const totalItems = countResult[0].total;

    // Get matches
    const [matches] = await pool.execute(
      `SELECT * FROM matches${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...whereParams, maxLimit, offset]
    );

    // Format response
    const formattedMatches = matches.map(match => ({
      id: match.id,
      home: {
        id: match.home_team_id,
        name: match.home_team_name,
        logo: match.home_team_logo
      },
      away: {
        id: match.away_team_id,
        name: match.away_team_name,
        logo: match.away_team_logo
      },
      date: match.match_date,
      time: match.match_time,
      status: {
        stage: match.status_stage
      },
      competition: {
        name: match.competition_name,
        season: match.competition_season,
        region: match.competition_region
      },
      sport: match.sport,
      odds: match.odds_data ? JSON.parse(match.odds_data) : null,
      sofascoreId: match.sofascore_id,
      totalcornerId: match.totalcorner_id,
      createdAt: match.created_at,
      updatedAt: match.updated_at
    }));

    const totalPages = Math.ceil(totalItems / maxLimit);

    res.json({
      success: true,
      data: formattedMatches,
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
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Get single match by ID
const getMatchById = async (req, res) => {
  try {
    const { matchId } = req.params;

    const [matches] = await pool.execute(
      'SELECT * FROM matches WHERE id = ?',
      [matchId]
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
        code: 'MATCH_NOT_FOUND'
      });
    }

    const match = matches[0];

    // Get related tips
    const [tips] = await pool.execute(
      'SELECT id, selection, market_type, odds, status, created_at FROM tips WHERE match_id = ?',
      [matchId]
    );

    const response = {
      id: match.id,
      home: {
        id: match.home_team_id,
        name: match.home_team_name,
        logo: match.home_team_logo
      },
      away: {
        id: match.away_team_id,
        name: match.away_team_name,
        logo: match.away_team_logo
      },
      date: match.match_date,
      time: match.match_time,
      status: {
        stage: match.status_stage
      },
      competition: {
        name: match.competition_name,
        season: match.competition_season,
        region: match.competition_region
      },
      sport: match.sport,
      odds: match.odds_data ? JSON.parse(match.odds_data) : null,
      statistics: match.statistics ? JSON.parse(match.statistics) : null,
      sofascoreId: match.sofascore_id,
      totalcornerId: match.totalcorner_id,
      createdAt: match.created_at,
      updatedAt: match.updated_at,
      relatedTips: tips.map(tip => ({
        id: tip.id,
        selection: tip.selection,
        marketType: tip.market_type,
        odds: parseFloat(tip.odds),
        status: tip.status,
        createdAt: tip.created_at
      }))
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get match by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Create new match (admin only)
const createMatch = async (req, res) => {
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
      home_team_id,
      home_team_name,
      home_team_logo,
      away_team_id,
      away_team_name,
      away_team_logo,
      match_date,
      match_time,
      sport,
      competition_name,
      competition_season,
      competition_region,
      status_stage = 'notstarted',
      odds_data,
      statistics,
      sofascore_id,
      totalcorner_id
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO matches (
        id, home_team_id, home_team_name, home_team_logo, 
        away_team_id, away_team_name, away_team_logo,
        match_date, match_time, sport, competition_name, 
        competition_season, competition_region, status_stage,
        odds_data, statistics, sofascore_id, totalcorner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id || `match_${Date.now()}`, home_team_id, home_team_name, home_team_logo,
        away_team_id, away_team_name, away_team_logo,
        match_date, match_time, sport, competition_name,
        competition_season, competition_region, status_stage,
        odds_data ? JSON.stringify(odds_data) : null,
        statistics ? JSON.stringify(statistics) : null,
        sofascore_id, totalcorner_id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      matchId: id || `match_${Date.now()}`
    });

  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Update match (admin only)
const updateMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const updateData = req.body;

    // Build update query
    const allowedFields = [
      'home_team_id', 'home_team_name', 'home_team_logo',
      'away_team_id', 'away_team_name', 'away_team_logo',
      'match_date', 'match_time', 'sport', 'competition_name',
      'competition_season', 'competition_region', 'status_stage',
      'odds_data', 'statistics', 'sofascore_id', 'totalcorner_id'
    ];

    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'odds_data' || key === 'statistics') {
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

    values.push(matchId);

    const [result] = await pool.execute(
      `UPDATE matches SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
        code: 'MATCH_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Match updated successfully'
    });

  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Delete match (admin only)
const deleteMatch = async (req, res) => {
  try {
    const { matchId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM matches WHERE id = ?',
      [matchId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
        code: 'MATCH_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Match deleted successfully'
    });

  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  getAllMatches,
  getMatchById,
};