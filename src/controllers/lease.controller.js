const Lease = require('../models/Lease');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const createLease = async (req, res) => {
  try {
    const { unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, notes } = req.body;

    const lease = await Lease.create({
      unit_id,
      tenant_id,
      start_date,
      end_date,
      rent_amount,
      deposit_amount,
      notes,
      status: 'PENDING'
    });

    return successResponse(res, lease, 'Lease created successfully', 201);
  } catch (error) {
    console.error('Error in createLease:', error);
    return errorResponse(res, 'Failed to create lease', 400, error);
  }
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getLeases = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Lease.findAll({
      where,
      include: ['unit', 'tenant'],
      limit: size,
      order
    });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Leases retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getLeases:', error);
    return errorResponse(res, 'Failed to retrieve leases', 400, error);
  }
};

const getLease = async (req, res) => {
  try {
    const lease = await Lease.findByPk(req.params.leaseId, {
      include: ['unit', 'tenant']
    });
    if (!lease) {
      throw new ApiError(404, 'Lease not found');
    }
    return successResponse(res, lease, 'Lease retrieved successfully');
  } catch (error) {
    console.error('Error in getLease:', error);
    return errorResponse(res, 'Failed to retrieve lease', 400, error);
  }
};

const updateLeaseStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const lease = await Lease.findByPk(req.params.leaseId);
    
    if (!lease) {
      throw new ApiError(404, 'Lease not found');
    }
    
    // Valid status transitions can be checked here
    const validStatuses = ['PENDING', 'ACTIVE', 'TERMINATED', 'RENEWED'];
    if (status && validStatuses.includes(status)) {
      lease.status = status;
      await lease.save();
      return successResponse(res, lease, 'Lease status updated successfully');
    }
    
    throw new ApiError(400, 'Invalid status update');
  } catch (error) {
    console.error('Error in updateLeaseStatus:', error);
    return errorResponse(res, 'Failed to update lease status', 400, error);
  }
};

module.exports = {
  createLease,
  getLeases,
  getLease,
  updateLeaseStatus
};
