const settingsService = require('../services/settings.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const ApiError = require('../utils/ApiError');

// Fetch settings for category and scope
const getSettings = async (req, res) => {
  try {
    const { category } = req.params;
    const { property_id } = req.query;

    const role = req.user.role;
    // Server-side authorization check: Tenants and Vendors can only view general/appearance settings or personal preferences
    const staffCategories = ['ORGANIZATION', 'RENTAL', 'FINANCE', 'INTEGRATIONS', 'SECURITY'];
    if (staffCategories.includes(category.toUpperCase()) && !['ADMIN', 'OWNER'].includes(role)) {
      return errorResponse(res, 'Access denied to administrative settings', 403);
    }

    const settings = await settingsService.getResolvedSetting(category.toUpperCase(), property_id);
    return successResponse(res, settings, `${category} settings retrieved successfully`);
  } catch (error) {
    console.error('Error in getSettings:', error);
    return errorResponse(res, error.message || 'Failed to retrieve settings', error.statusCode || 400);
  }
};

// Update settings for category and scope
const updateSettings = async (req, res) => {
  try {
    const { category } = req.params;
    const { scope = 'GLOBAL', scope_id, value } = req.body;

    const role = req.user.role;
    // Critical authorization check: Only ADMIN or OWNER can update org, rental, finance, integrations, security
    if (!['ADMIN', 'OWNER'].includes(role)) {
      return errorResponse(res, 'Unauthorized to modify administrative settings', 403);
    }

    if (!value || typeof value !== 'object') {
      return errorResponse(res, 'Invalid settings value provided', 400);
    }

    const updated = await settingsService.updateSetting({
      scope,
      scope_id,
      category: category.toUpperCase(),
      value,
      userId: req.user.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return successResponse(res, updated, `${category} settings updated successfully`);
  } catch (error) {
    console.error('Error in updateSettings:', error);
    return errorResponse(res, error.message || 'Failed to update settings', error.statusCode || 400);
  }
};

// Get personal user profile & preferences
const getProfilePreferences = async (req, res) => {
  try {
    const profile = await settingsService.getUserPreferences(req.user.id);
    return successResponse(res, profile, 'Profile preferences retrieved successfully');
  } catch (error) {
    console.error('Error in getProfilePreferences:', error);
    return errorResponse(res, error.message || 'Failed to get profile preferences', error.statusCode || 400);
  }
};

// Update personal profile
const updateProfile = async (req, res) => {
  try {
    const updated = await settingsService.updateUserProfile(
      req.user.id,
      req.body,
      req.ip || req.headers['x-forwarded-for']
    );
    return successResponse(res, updated, 'Profile updated successfully');
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return errorResponse(res, error.message || 'Failed to update profile', error.statusCode || 400);
  }
};

// Update personal preferences
const updatePreferences = async (req, res) => {
  try {
    const updated = await settingsService.updateUserPreferences(req.user.id, req.body);
    return successResponse(res, updated, 'Preferences updated successfully');
  } catch (error) {
    console.error('Error in updatePreferences:', error);
    return errorResponse(res, error.message || 'Failed to update preferences', error.statusCode || 400);
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }

    await settingsService.changePassword(
      req.user.id,
      current_password,
      new_password,
      req.ip || req.headers['x-forwarded-for']
    );
    return successResponse(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Error in changePassword:', error);
    return errorResponse(res, error.message || 'Failed to change password', error.statusCode || 400);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getProfilePreferences,
  updateProfile,
  updatePreferences,
  changePassword,
};
