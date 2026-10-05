const unitService = require('../services/unit.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

// ==================== UNIT CONTROLLERS ====================

const getUnits = async (req, res) => {
  try {
    const { limit, cursor, property, property_id, status } = req.query;
    const propertyId = property || property_id;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    if (status) where.status = status;
    const data = await unitService.getUnits(propertyId, size, where, order);
    const { rows, meta } = getCursorPagingData(data, size);

    return successResponse(res, rows, 'Units retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getUnits:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve units', statusCode, error);
  }
};

const getUnit = async (req, res) => {
  try {
    const unit = await unitService.getUnitById(req.params.unitId);
    return successResponse(res, unit, 'Unit retrieved successfully');
  } catch (error) {
    console.error('Error in getUnit:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve unit', statusCode, error);
  }
};

const createUnit = async (req, res) => {
  try {
    const unit = await unitService.createUnit(req.body);
    return successResponse(res, unit, 'Unit created successfully', 201);
  } catch (error) {
    console.error('Error in createUnit:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create unit', statusCode, error);
  }
};

const updateUnit = async (req, res) => {
  try {
    const unit = await unitService.updateUnit(req.params.unitId, req.body);
    return successResponse(res, unit, 'Unit updated successfully');
  } catch (error) {
    console.error('Error in updateUnit:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update unit', statusCode, error);
  }
};

const deleteUnit = async (req, res) => {
  try {
    const unit = await unitService.deleteUnit(req.params.unitId);
    return successResponse(res, unit, 'Unit deleted successfully');
  } catch (error) {
    console.error('Error in deleteUnit:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete unit', statusCode, error);
  }
};

// ==================== UNIT TYPE CONTROLLERS ====================

const getUnitTypes = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await unitService.getUnitTypes(size, where, order);
    const { rows, meta } = getCursorPagingData(data, size);

    return successResponse(res, rows, 'Unit types retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getUnitTypes:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve unit types', statusCode, error);
  }
};

const getUnitType = async (req, res) => {
  try {
    const unitType = await unitService.getUnitTypeById(req.params.typeId);
    return successResponse(res, unitType, 'Unit type retrieved successfully');
  } catch (error) {
    console.error('Error in getUnitType:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve unit type', statusCode, error);
  }
};

const createUnitType = async (req, res) => {
  try {
    const unitType = await unitService.createUnitType(req.body);
    return successResponse(res, unitType, 'Unit type created successfully', 201);
  } catch (error) {
    console.error('Error in createUnitType:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create unit type', statusCode, error);
  }
};

const updateUnitType = async (req, res) => {
  try {
    const unitType = await unitService.updateUnitType(req.params.typeId, req.body);
    return successResponse(res, unitType, 'Unit type updated successfully');
  } catch (error) {
    console.error('Error in updateUnitType:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update unit type', statusCode, error);
  }
};

const deleteUnitType = async (req, res) => {
  try {
    const result = await unitService.deleteUnitType(req.params.typeId);
    return successResponse(res, result, 'Unit type deleted successfully');
  } catch (error) {
    console.error('Error in deleteUnitType:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete unit type', statusCode, error);
  }
};

module.exports = {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitTypes,
  getUnitType,
  createUnitType,
  updateUnitType,
  deleteUnitType
};