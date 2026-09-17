const unitService = require('../services/unit.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getUnits = async (req, res) => {
  try {
    const { limit, cursor, property: propertyId } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await unitService.getUnits(propertyId, size, where, order);
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Units retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getUnits:', error);
    return errorResponse(res, 'Failed to retrieve units', 400, error);
  }
};

const createUnit = async (req, res) => {
  try {
    const unit = await unitService.createUnit(req.body);
    return successResponse(res, unit, 'Unit created successfully', 201);
  } catch (error) {
    console.error('Error in createUnit:', error);
    return errorResponse(res, 'Failed to create unit', 400, error);
  }
};

const updateUnit = async (req, res) => {
  try {
    const unit = await unitService.updateUnit(req.params.unitId, req.body);
    return successResponse(res, unit, 'Unit updated successfully');
  } catch (error) {
    console.error('Error in updateUnit:', error);
    return errorResponse(res, error.message || 'Failed to update unit', 400, error);
  }
};

const deleteUnit = async (req, res) => {
  try {
    const unit = await unitService.deleteUnit(req.params.unitId);
    return successResponse(res, unit, 'Unit deleted successfully');
  } catch (error) {
    console.error('Error in deleteUnit:', error);
    return errorResponse(res, error.message || 'Failed to delete unit', 400, error);
  }
};

module.exports = {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
};
