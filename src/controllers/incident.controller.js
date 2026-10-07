const Incident = require('../models/Incident');
const Property = require('../models/Property');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const ApiError = require('../utils/ApiError');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const createIncident = async (req, res, next) => {
  try {
    const { title, description, property_id, severity } = req.body;
    if (!property_id || !title) {
      throw new ApiError(400, 'Title and Property ID are required');
    }

    const incident = await Incident.create({
      title,
      description,
      property_id,
      severity: severity || 'MEDIUM',
      reported_by: req.user.id,
      status: 'OPEN',
    });

    return successResponse(res, incident, 'Incident logged successfully', 201);
  } catch (error) {
    next(error);
  }
};

const getIncidents = async (req, res, next) => {
  try {
    const { limit, cursor, status, property_id } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    
    if (status) where.status = status;
    if (property_id) where.property_id = property_id;

    // If caretaker, maybe limit to properties they are assigned to, but for now we just show all if they request it, or filter by requested property.
    // If we have Caretaker Property assignment later, we enforce it here.

    const data = await Incident.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name', 'address'] },
        { model: User, as: 'reporter', attributes: ['id', 'username', 'role'] }
      ],
      limit: size,
      order,
    });

    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Incidents retrieved successfully', 200, meta);
  } catch (error) {
    next(error);
  }
};

const updateIncidentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const incident = await Incident.findByPk(req.params.id);
    if (!incident) {
      throw new ApiError(404, 'Incident not found');
    }

    incident.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      incident.resolved_at = new Date();
    }
    await incident.save();

    return successResponse(res, incident, 'Incident status updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createIncident,
  getIncidents,
  updateIncidentStatus,
};
