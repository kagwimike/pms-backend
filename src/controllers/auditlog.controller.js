const AuditLog = require('../models/AuditLog');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getAuditLogs = async (req, res) => {
  try {
    const { limit, cursor, entity_type, entity_id, user_id } = req.query;
    // getCursorPagination already sets order to [['id', 'DESC']]
    const { limit: size, where, order } = getCursorPagination(cursor, limit);

    const filter = { ...where };
    if (entity_type) filter.entity_type = entity_type;
    if (entity_id) filter.entity_id = entity_id;
    if (user_id) filter.user_id = user_id;

    const data = await AuditLog.findAll({
      where: filter,
      order,
      include: ['user'],
      limit: size
    });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Audit logs retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getAuditLogs:', error);
    return errorResponse(res, 'Failed to retrieve audit logs', 400, error);
  }
};

module.exports = {
  getAuditLogs
};
