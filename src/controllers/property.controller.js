const propertyService = require('../services/property.service');
const { successResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

/**
 * Accepts amenities in any shape a client may send them:
 *   JSON array string  '["Pool","WiFi"]'
 *   bracketed list     '[Pool, WiFi]'   (e.g. a stringified Dart/Python list)
 *   comma separated    'Pool, WiFi'
 *   real array         ['Pool', 'WiFi'] / [1, 2]
 */
const parseList = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'number') return [value];
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return trimmed
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
};

const isNumeric = (a) => typeof a === 'number' || (typeof a === 'string' && a.trim() !== '' && !isNaN(Number(a)));

const splitAmenities = (amenities, newAmenities) => {
  const parsed = parseList(amenities);
  const ids = parsed.filter(isNumeric).map(Number);
  const names = [...parseList(newAmenities), ...parsed.filter((a) => !isNumeric(a))]
    .filter((a) => typeof a === 'string' && a.trim())
    .map((a) => a.trim());
  return { ids, names: [...new Set(names)] };
};

const createProperty = async (req, res) => {
  const { amenities, new_amenities, ...propertyData } = req.body;
  const { ids, names } = splitAmenities(amenities, new_amenities);
  const property = await propertyService.createProperty(propertyData, req.user.id, req.files || [], ids, names);
  return successResponse(res, property, 'Property created successfully', 201);
};

const getProperties = async (req, res) => {
  const { limit, cursor } = req.query;
  const { limit: size, where, order } = getCursorPagination(cursor, limit);
  const data = await propertyService.getProperties(req.user, size, where, order);
  const { rows, meta } = getCursorPagingData(data, size);

  return successResponse(res, rows, 'Properties retrieved successfully', 200, meta);
};

const getProperty = async (req, res) => {
  const property = await propertyService.getPropertyById(req.params.propertyId, req.user);
  return successResponse(res, property, 'Property retrieved successfully');
};

const updateProperty = async (req, res) => {
  const { amenities, new_amenities, ...propertyData } = req.body;
  const hasAmenityPayload = amenities !== undefined || new_amenities !== undefined;
  const { ids, names } = splitAmenities(amenities, new_amenities);
  const property = await propertyService.updateProperty(
    req.params.propertyId,
    propertyData,
    req.user,
    hasAmenityPayload ? ids : null,
    names,
  );
  return successResponse(res, property, 'Property updated successfully');
};

const deleteProperty = async (req, res) => {
  const property = await propertyService.deleteProperty(req.params.propertyId, req.user);
  return successResponse(res, property, 'Property deleted successfully');
};

module.exports = {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
};
