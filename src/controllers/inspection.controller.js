const Inspection = require('../models/Inspection');
const Damage = require('../models/Damage');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const createInspection = async (req, res) => {
  try {
    const inspection = await Inspection.create({
      ...req.body,
      inspector_id: req.user.id
    });
    return successResponse(res, inspection, 'Inspection created successfully', 201);
  } catch (error) {
    console.error('Error in createInspection:', error);
    return errorResponse(res, 'Failed to create inspection', 400, error);
  }
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getInspections = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Inspection.findAll({ where, include: ['lease', 'inspector', 'damages'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Inspections retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getInspections:', error);
    return errorResponse(res, 'Failed to retrieve inspections', 400, error);
  }
};

const getInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId, { include: ['lease', 'inspector', 'damages'] });
    if (!inspection) throw new ApiError(404, 'Inspection not found');
    return successResponse(res, inspection, 'Inspection retrieved successfully');
  } catch (error) {
    console.error('Error in getInspection:', error);
    return errorResponse(res, 'Failed to retrieve inspection', 400, error);
  }
};

const createDamage = async (req, res) => {
  try {
    const damage = await Damage.create(req.body);
    return successResponse(res, damage, 'Damage created successfully', 201);
  } catch (error) {
    console.error('Error in createDamage:', error);
    return errorResponse(res, 'Failed to create damage', 400, error);
  }
};

const updateInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId);
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    if (inspection.status === 'COMPLETED') {
      throw new ApiError(400, 'Cannot modify an inspection after sign-off');
    }
    
    Object.assign(inspection, req.body);
    await inspection.save();
    return successResponse(res, inspection, 'Inspection updated successfully');
  } catch (error) {
    console.error('Error in updateInspection:', error);
    return errorResponse(res, 'Failed to update inspection', 400, error);
  }
};

module.exports = {
  createInspection,
  getInspections,
  getInspection,
  updateInspection,
  createDamage
};
