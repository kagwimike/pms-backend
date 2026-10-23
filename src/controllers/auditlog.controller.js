const { Op } = require('sequelize');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const ApiError = require('../utils/ApiError');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');
const AuditService = require('../services/audit.service');

const SAFE_USER_ATTRIBUTES = ['id', 'username', 'email', 'first_name', 'last_name', 'role'];

const getAuditLogs = async (req, res) => {
  try {
    const {
      limit,
      cursor,
      module: mod,
      action,
      outcome,
      severity,
      entity_type,
      entity_id,
      property_id,
      user_id,
      search,
      start_date,
      end_date,
    } = req.query;

    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const filter = { ...where };

    if (mod) filter.module = String(mod).toUpperCase();
    if (action) filter.action = String(action).toUpperCase();
    if (outcome) filter.outcome = String(outcome).toUpperCase();
    if (severity) filter.severity = String(severity).toUpperCase();
    if (entity_type) filter.entity_type = String(entity_type).toUpperCase();
    if (entity_id) filter.entity_id = entity_id;
    if (property_id) filter.property_id = property_id;
    if (user_id) filter.user_id = user_id;

    // Date range filters
    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) {
        filter.created_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        filter.created_at[Op.lte] = new Date(end_date);
      }
    }

    // Text search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      filter[Op.or] = [
        { summary: { [Op.like]: searchTerm } },
        { action: { [Op.like]: searchTerm } },
        { entity_type: { [Op.like]: searchTerm } },
        { module: { [Op.like]: searchTerm } },
        { '$user.username$': { [Op.like]: searchTerm } },
        { '$user.email$': { [Op.like]: searchTerm } },
      ];
    }

    const data = await AuditLog.findAll({
      where: filter,
      order,
      include: [
        {
          model: User,
          as: 'user',
          attributes: SAFE_USER_ATTRIBUTES,
        },
      ],
      limit: size,
    });

    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Audit logs retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getAuditLogs:', error);
    return errorResponse(res, 'Failed to retrieve audit logs', 400, error);
  }
};

const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: SAFE_USER_ATTRIBUTES,
        },
      ],
    });

    if (!log) {
      throw new ApiError(404, 'Audit event not found');
    }

    return successResponse(res, log, 'Audit log retrieved successfully');
  } catch (error) {
    console.error('Error in getAuditLogById:', error);
    return errorResponse(res, error.message || 'Failed to retrieve audit log', error.statusCode || 400, error);
  }
};

const exportAuditLogs = async (req, res) => {
  try {
    const { module: mod, outcome, severity, start_date, end_date } = req.query;
    const filter = {};

    if (mod) filter.module = String(mod).toUpperCase();
    if (outcome) filter.outcome = String(outcome).toUpperCase();
    if (severity) filter.severity = String(severity).toUpperCase();

    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) filter.created_at[Op.gte] = new Date(start_date);
      if (end_date) filter.created_at[Op.lte] = new Date(end_date);
    }

    const logs = await AuditLog.findAll({
      where: filter,
      order: [['id', 'DESC']],
      limit: 1000,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email'],
        },
      ],
    });

    // Record the export action in the audit trail
    await AuditService.logEvent({
      req,
      action: 'AUDIT_LOG_EXPORT',
      module: 'SECURITY',
      entity_type: 'AUDIT_LOG',
      summary: `Admin ${req.user.username} exported ${logs.length} audit trail records to CSV`,
      outcome: 'SUCCESS',
      severity: 'WARNING',
      details: { export_count: logs.length, filters: { module: mod, outcome, severity } },
    });

    // Generate CSV
    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'Module',
      'Action',
      'Entity Type',
      'Entity ID',
      'Outcome',
      'Severity',
      'Actor',
      'Actor Role',
      'IP Address',
      'Summary',
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [headers.join(',')];
    for (const log of logs) {
      const actorName = log.user ? log.user.username : 'System';
      const row = [
        log.id,
        log.created_at ? log.created_at.toISOString() : '',
        escapeCsv(log.module),
        escapeCsv(log.action),
        escapeCsv(log.entity_type),
        log.entity_id || '',
        escapeCsv(log.outcome),
        escapeCsv(log.severity),
        escapeCsv(actorName),
        escapeCsv(log.actor_role || ''),
        escapeCsv(log.ip_address || ''),
        escapeCsv(log.summary || ''),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error in exportAuditLogs:', error);
    return errorResponse(res, 'Failed to export audit logs', 400, error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  exportAuditLogs,
};
