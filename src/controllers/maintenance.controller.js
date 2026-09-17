const MaintenanceRequest = require('../models/MaintenanceRequest');
const Vendor = require('../models/Vendor');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const Lease = require('../models/Lease');
const Unit = require('../models/Unit');

const createMaintenanceRequest = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    
    // Check if the user is a tenant with an active or pending lease
    const activeLease = await Lease.findOne({
      where: { 
        tenant_id: req.user.id, 
        status: { [Op.in]: ['ACTIVE', 'PENDING'] }
      },
      include: [{ model: Unit, as: 'unit' }]
    });

    if (!activeLease || !activeLease.unit) {
      throw new ApiError(400, 'You must have an active lease to submit a maintenance request.');
    }

    const request = await MaintenanceRequest.create({
      ...req.body,
      tenant_id: req.user.id,
      unit_id: activeLease.unit_id,
      property_id: activeLease.unit.property_id
    });
    
    return successResponse(res, request, 'Maintenance Request created successfully', 201);
  } catch (error) {
    next(error); // Pass to global error handler for graceful constraint messages
  }
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getMaintenanceRequests = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await MaintenanceRequest.findAll({ 
      where,
      include: ['tenant', 'property', 'unit', 'assigned_vendor'],
      limit: size,
      order
    });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Maintenance Requests retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getMaintenanceRequests:', error);
    return errorResponse(res, 'Failed to retrieve maintenance requests', 400, error);
  }
};

const getMaintenanceRequest = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findByPk(req.params.requestId, { include: ['tenant', 'property', 'unit', 'assigned_vendor'] });
    if (!request) throw new ApiError(404, 'Maintenance Request not found');
    return successResponse(res, request, 'Maintenance Request retrieved successfully');
  } catch (error) {
    console.error('Error in getMaintenanceRequest:', error);
    return errorResponse(res, 'Failed to retrieve maintenance request', 400, error);
  }
};

const createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    return successResponse(res, vendor, 'Vendor created successfully', 201);
  } catch (error) {
    console.error('Error in createVendor:', error);
    return errorResponse(res, 'Failed to create vendor', 400, error);
  }
};

const getVendors = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Vendor.findAll({ where, limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Vendors retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getVendors:', error);
    return errorResponse(res, 'Failed to retrieve vendors', 400, error);
  }
};

const updateMaintenanceRequest = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findByPk(req.params.requestId);
    if (!request) throw new ApiError(404, 'Maintenance Request not found');

    if (request.status === 'COMPLETED' || request.status === 'VERIFIED') {
      // If closed, only allow status updates (e.g. reopen, or transition to VERIFIED)
      const allowedKeys = ['status', 'vendor_notes'];
      const updates = Object.keys(req.body);
      for (const key of updates) {
        if (!allowedKeys.includes(key)) {
          throw new ApiError(400, 'Cannot modify core details of a closed ticket');
        }
      }
    }
    
    Object.assign(request, req.body);
    await request.save();
    return successResponse(res, request, 'Maintenance Request updated successfully');
  } catch (error) {
    console.error('Error in updateMaintenanceRequest:', error);
    return errorResponse(res, 'Failed to update maintenance request', 400, error);
  }
};

const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    Object.assign(vendor, req.body);
    await vendor.save();
    return successResponse(res, vendor, 'Vendor updated successfully');
  } catch (error) {
    console.error('Error in updateVendor:', error);
    return errorResponse(res, 'Failed to update vendor', 400, error);
  }
};

const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    await vendor.destroy(); // soft-delete due to paranoid
    return successResponse(res, vendor, 'Vendor deleted successfully');
  } catch (error) {
    console.error('Error in deleteVendor:', error);
    return errorResponse(res, 'Failed to delete vendor', 400, error);
  }
};

module.exports = {
  createMaintenanceRequest,
  getMaintenanceRequests,
  getMaintenanceRequest,
  updateMaintenanceRequest,
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor
};
