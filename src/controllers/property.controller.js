const propertyService = require('../services/property.service');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const createProperty = async (req, res) => {
  const ownerId = req.user.id; 
  const { amenities, new_amenities, ...propertyData } = req.body;
  const images = req.files || [];

  let parsedAmenities = [];
  if (amenities) {
    try {
      parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : (Array.isArray(amenities) ? amenities : []);
    } catch (e) {
      if (typeof amenities === 'string' && amenities.trim()) {
        parsedAmenities = [amenities.trim()];
      }
    }
  }

  let parsedNewAmenities = [];
  if (new_amenities) {
    try {
      parsedNewAmenities = typeof new_amenities === 'string' ? JSON.parse(new_amenities) : (Array.isArray(new_amenities) ? new_amenities : []);
    } catch (e) {
      if (typeof new_amenities === 'string' && new_amenities.trim()) {
        parsedNewAmenities = [new_amenities.trim()];
      }
    }
  }

  const amenityIds = parsedAmenities
    .filter(a => typeof a === 'number' || (typeof a === 'string' && !isNaN(Number(a)) && a.trim() !== ''))
    .map(Number);
  const amenityStrings = parsedAmenities.filter(a => typeof a === 'string' && isNaN(Number(a)));
  
  parsedNewAmenities = [...new Set([...parsedNewAmenities, ...amenityStrings])];

  const property = await propertyService.createProperty(propertyData, ownerId, images, amenityIds, parsedNewAmenities);
  return successResponse(res, property, 'Property created successfully', 201);
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getProperties = async (req, res) => {
  const { limit, cursor } = req.query;
  const { limit: size, where, order } = getCursorPagination(cursor, limit);
  const data = await propertyService.getProperties(req.user, size, where, order);
  const { rows, meta } = getCursorPagingData(data, size);
  
  return successResponse(res, rows, 'Properties retrieved successfully', 200, meta);
};

const getProperty = async (req, res) => {
  const property = await propertyService.getPropertyById(req.params.propertyId);
  return successResponse(res, property, 'Property retrieved successfully');
};

const updateProperty = async (req, res) => {
  const property = await propertyService.updateProperty(req.params.propertyId, req.body);
  return successResponse(res, property, 'Property updated successfully');
};

const deleteProperty = async (req, res) => {
  const property = await propertyService.deleteProperty(req.params.propertyId);
  return successResponse(res, property, 'Property deleted successfully');
};

module.exports = {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty
};
