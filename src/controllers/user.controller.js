const userService = require('../services/user.service');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getUsers = async (req, res) => {
  try {
    const { limit, cursor, role } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    if (role) {
      where.role = role;
    }
    const data = await User.findAll({
      where,
      limit: size,
      order,
      attributes: { exclude: ['password'] }
    });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Users retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getUsers:', error);
    return errorResponse(res, 'Failed to retrieve users', 400, error);
  }
};

const getUser = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.userId);
    return successResponse(res, user, 'User retrieved successfully');
  } catch (error) {
    console.error('Error in getUser:', error);
    return errorResponse(res, 'Failed to retrieve user', 400, error);
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUserById(req.params.userId, req.body);
    return successResponse(res, user, 'User updated successfully');
  } catch (error) {
    console.error('Error in updateUser:', error);
    return errorResponse(res, 'Failed to update user', 400, error);
  }
};

const archiveTenant = async (req, res) => {
  try {
    const user = await userService.archiveTenant(req.params.userId);
    return successResponse(res, user, 'Tenant archived successfully');
  } catch (error) {
    console.error('Error in archiveTenant:', error);
    return errorResponse(res, error.message || 'Failed to archive tenant', 400, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await userService.deleteUser(req.params.userId);
    return successResponse(res, user, 'User soft-deleted successfully');
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return errorResponse(res, error.message || 'Failed to delete user', 400, error);
  }
};

module.exports = {
  getUsers,
  getUser,
  updateUser,
  archiveTenant,
  deleteUser,
};
