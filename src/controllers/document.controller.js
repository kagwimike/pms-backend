const Document = require('../models/Document');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const ApiError = require('../utils/ApiError');

const createDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded');

    const document = await Document.create({
      ...req.body,
      file_path: `documents/${file.filename}`,
      uploaded_by_id: req.user.id
    });
    return successResponse(res, document, 'Document uploaded successfully', 201);
  } catch (error) {
    console.error('Error in createDocument:', error);
    return errorResponse(res, error.message || 'Failed to upload document', 400, error);
  }
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getDocuments = async (req, res) => {
  try {
    const { limit, cursor, entity_type, entity_id } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    
    const filter = { ...where };
    if (entity_type) filter.entity_type = entity_type;
    if (entity_id) filter.entity_id = entity_id;

    const data = await Document.findAll({ where: filter, limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    
    return successResponse(res, rows, 'Documents retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getDocuments:', error);
    return errorResponse(res, 'Failed to retrieve documents', 400, error);
  }
};

const getDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId);
    if (!document) throw new ApiError(404, 'Document not found');
    return successResponse(res, document, 'Document retrieved successfully');
  } catch (error) {
    console.error('Error in getDocument:', error);
    return errorResponse(res, 'Failed to retrieve document', 400, error);
  }
};

const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId);
    if (!document) throw new ApiError(404, 'Document not found');
    await document.destroy();
    return successResponse(res, document, 'Document deleted successfully');
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return errorResponse(res, 'Failed to delete document', 400, error);
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocument,
  deleteDocument
};
