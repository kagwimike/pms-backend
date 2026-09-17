const propertyService = require('../services/property.service');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const createProperty = async (req, res) => {
  const ownerId = req.user.id; 
  const { amenities, new_amenities, ...propertyData } = req.body;
  const images = req.files; // Array of uploaded files attached by multer
  
  let parsedAmenities = amenities ? JSON.parse(amenities) : [];
  let parsedNewAmenities = new_amenities ? JSON.parse(new_amenities) : [];

  // Separate IDs (numbers) from new amenity names (strings) if the user mixed them
  const amenityIds = parsedAmenities.filter(a => typeof a === 'number');
  const amenityStrings = parsedAmenities.filter(a => typeof a === 'string');
  
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
