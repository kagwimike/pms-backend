const Inspection = require('../models/Inspection');
const Damage = require('../models/Damage');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

// ==================== INSPECTION CONTROLLERS ====================

const createInspection = async (req, res) => {
  try {
    const inspection = await Inspection.create({
      ...req.body,
      inspector_id: req.user.id
    });
    return successResponse(res, inspection, 'Inspection created successfully', 201);
  } catch (error) {
    console.error('Error in createInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create inspection', statusCode, error);
  }
};

const getInspections = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Inspection.findAll({ where, include: ['lease', 'inspector', 'damages'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Inspections retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getInspections:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve inspections', statusCode, error);
  }
};

const getInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId, { include: ['lease', 'inspector', 'damages'] });
    if (!inspection) throw new ApiError(404, 'Inspection not found');
    return successResponse(res, inspection, 'Inspection retrieved successfully');
  } catch (error) {
    console.error('Error in getInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve inspection', statusCode, error);
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
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update inspection', statusCode, error);
  }
};

const deleteInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId);
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    await inspection.destroy();
    return successResponse(res, null, 'Inspection deleted successfully', 200);
  } catch (error) {
    console.error('Error in deleteInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete inspection', statusCode, error);
  }
};

// ==================== DAMAGE CONTROLLERS ====================

const createDamage = async (req, res) => {
  try {
    // Extract inspectionId either from route param (/inspections/:inspectionId/damages) or body
    const inspectionId = req.params.inspectionId || req.body.inspection_id || req.body.inspectionId;

    if (!inspectionId) {
      throw new ApiError(400, 'Inspection ID is required');
    }

    const inspection = await Inspection.findByPk(inspectionId);
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    if (inspection.status === 'COMPLETED') {
      throw new ApiError(400, 'Cannot add damages to a completed inspection');
    }

    const damage = await Damage.create({
      ...req.body,
      inspection_id: inspectionId
    });

    return successResponse(res, damage, 'Damage recorded successfully', 201);
  } catch (error) {
    console.error('Error in createDamage:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create damage record', statusCode, error);
  }
};

const getDamagesByInspection = async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const damages = await Damage.findAll({ where: { inspection_id: inspectionId } });
    
    return successResponse(res, damages, 'Damages retrieved successfully');
  } catch (error) {
    console.error('Error in getDamagesByInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve damages', statusCode, error);
  }
};

module.exports = {
  createInspection,
  getInspections,
  getInspection,
  updateInspection,
  deleteInspection,
  createDamage,
  getDamagesByInspection
};