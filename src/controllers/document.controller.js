const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const Document = require('../models/Document');
const User = require('../models/User');
const Lease = require('../models/Lease');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');
const AuditService = require('../services/audit.service');
const { documentDir } = require('../middleware/documentUpload.middleware');

const SAFE_USER_ATTRIBUTES = ['id', 'username', 'email', 'first_name', 'last_name', 'role'];

/**
 * Check if the user has authorization to access the specific document.
 */
async function canAccessDocument(user, document) {
  if (!user || !document) return false;
  if (['ADMIN', 'OWNER'].includes(user.role)) return true;
  if (document.uploaded_by_id === user.id) return true;
  if (document.access_scope === 'PUBLIC') return true;

  if (user.role === 'TENANT') {
    if (document.access_scope === 'TENANT_SHARED') return true;
    if (document.entity_type === 'TENANT' && String(document.entity_id) === String(user.id)) return true;
    if (document.entity_type === 'LEASE' && document.entity_id) {
      const lease = await Lease.findByPk(document.entity_id);
      if (lease && lease.tenant_id === user.id) return true;
    }
  }

  if (user.role === 'VENDOR') {
    if (document.access_scope === 'VENDOR_SHARED') return true;
    if (document.entity_type === 'MAINTENANCE' && document.entity_id) {
      const mr = await MaintenanceRequest.findByPk(document.entity_id);
      if (mr && mr.assigned_vendor_id === user.id) return true;
    }
  }

  return false;
}

/**
 * Calculate SHA-256 hash of a file on disk.
 */
function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

const createDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded');

    const filePath = file.path;
    const checksum = await calculateChecksum(filePath).catch(() => null);
    const fileSize = file.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

    const {
      title,
      name, // backward compatibility with older UI
      document_type,
      entity_type,
      entity_id,
      property_id,
      description,
      expiry_date,
      access_scope,
    } = req.body;

    const docTitle = title || name || file.originalname;

    const document = await Document.create({
      title: docTitle,
      file_path: `documents/${file.filename}`,
      original_name: file.originalname,
      mime_type: file.mimetype,
      file_size: fileSize,
      checksum,
      version: 1,
      document_type: document_type || 'OTHER',
      entity_type: entity_type || 'GENERAL',
      entity_id: entity_id ? Number(entity_id) : null,
      property_id: property_id ? Number(property_id) : null,
      description: description || null,
      expiry_date: expiry_date || null,
      access_scope: access_scope || (req.user?.role === 'TENANT' ? 'TENANT_SHARED' : 'ORGANIZATION'),
      status: 'APPROVED',
      uploaded_by_id: req.user.id,
    });

    // Audit log
    await AuditService.logDocument({
      req,
      action: 'DOCUMENT_UPLOAD',
      documentId: document.id,
      propertyId: document.property_id,
      summary: `Uploaded document "${document.title}" (${document.document_type}, v1)`,
      details: {
        document_id: document.id,
        filename: file.originalname,
        mime_type: file.mimetype,
        file_size: fileSize,
        checksum,
        document_type: document.document_type,
        entity_type: document.entity_type,
        entity_id: document.entity_id,
      },
    });

    return successResponse(res, document, 'Document uploaded successfully', 201);
  } catch (error) {
    console.error('Error in createDocument:', error);
    return errorResponse(res, error.message || 'Failed to upload document', 400, error);
  }
};

const createDocumentVersion = async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded for new version');

    const parentDoc = await Document.findByPk(req.params.documentId);
    if (!parentDoc) throw new ApiError(404, 'Parent document not found');

    if (parentDoc.is_finalized) {
      throw new ApiError(400, 'Finalized documents cannot be replaced or updated with new versions.');
    }

    const authorized = await canAccessDocument(req.user, parentDoc);
    if (!authorized) throw new ApiError(403, 'Forbidden: You cannot upload versions for this document');

    const rootParentId = parentDoc.parent_document_id || parentDoc.id;

    // Find highest version currently in this family
    const familyDocs = await Document.findAll({
      where: {
        [Op.or]: [{ id: rootParentId }, { parent_document_id: rootParentId }],
      },
      attributes: ['version'],
    });

    const maxVersion = familyDocs.reduce((acc, d) => Math.max(acc, d.version || 1), 1);
    const newVersion = maxVersion + 1;

    const filePath = file.path;
    const checksum = await calculateChecksum(filePath).catch(() => null);
    const fileSize = file.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

    const versionDoc = await Document.create({
      title: req.body.title || parentDoc.title,
      file_path: `documents/${file.filename}`,
      original_name: file.originalname,
      mime_type: file.mimetype,
      file_size: fileSize,
      checksum,
      version: newVersion,
      parent_document_id: rootParentId,
      document_type: parentDoc.document_type,
      entity_type: parentDoc.entity_type,
      entity_id: parentDoc.entity_id,
      property_id: parentDoc.property_id,
      description: req.body.description || `Version ${newVersion} uploaded by ${req.user.username}`,
      expiry_date: req.body.expiry_date || parentDoc.expiry_date,
      access_scope: parentDoc.access_scope,
      status: 'APPROVED',
      uploaded_by_id: req.user.id,
    });

    await AuditService.logDocument({
      req,
      action: 'DOCUMENT_VERSION_CREATE',
      documentId: versionDoc.id,
      propertyId: versionDoc.property_id,
      summary: `Created new version ${newVersion} for document "${parentDoc.title}"`,
      details: {
        parent_document_id: rootParentId,
        new_version: newVersion,
        filename: file.originalname,
        file_size: fileSize,
        checksum,
      },
    });

    return successResponse(res, versionDoc, `Version ${newVersion} uploaded successfully`, 201);
  } catch (error) {
    console.error('Error in createDocumentVersion:', error);
    return errorResponse(res, error.message || 'Failed to upload document version', 400, error);
  }
};

const getDocuments = async (req, res) => {
  try {
    const {
      limit,
      cursor,
      entity_type,
      entity_id,
      property_id,
      document_type,
      status,
      is_archived,
      search,
    } = req.query;

    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const filter = { ...where };

    if (entity_type) filter.entity_type = String(entity_type).toUpperCase();
    if (entity_id) filter.entity_id = entity_id;
    if (property_id) filter.property_id = property_id;
    if (document_type) filter.document_type = String(document_type).toUpperCase();
    if (status) filter.status = String(status).toUpperCase();

    // Default to active/non-archived documents unless explicitly queried
    if (is_archived !== undefined) {
      filter.is_archived = is_archived === 'true' || is_archived === '1';
    } else {
      filter.is_archived = false;
    }

    // Role-based data isolation
    const user = req.user;
    if (user.role === 'TENANT') {
      const userLeases = await Lease.findAll({ where: { tenant_id: user.id }, attributes: ['id'] });
      const leaseIds = userLeases.map((l) => l.id);

      filter[Op.and] = [
        ...(filter[Op.and] || []),
        {
          [Op.or]: [
            { uploaded_by_id: user.id },
            { access_scope: { [Op.in]: ['TENANT_SHARED', 'PUBLIC'] } },
            { entity_type: 'TENANT', entity_id: user.id },
            ...(leaseIds.length > 0 ? [{ entity_type: 'LEASE', entity_id: { [Op.in]: leaseIds } }] : []),
          ],
        },
      ];
    } else if (user.role === 'VENDOR') {
      filter[Op.and] = [
        ...(filter[Op.and] || []),
        {
          [Op.or]: [
            { uploaded_by_id: user.id },
            { access_scope: { [Op.in]: ['VENDOR_SHARED', 'PUBLIC'] } },
          ],
        },
      ];
    }

    // Keyword search on title and original_name
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      filter[Op.or] = [
        { title: { [Op.like]: searchTerm } },
        { original_name: { [Op.like]: searchTerm } },
        { document_type: { [Op.like]: searchTerm } },
      ];
    }

    const data = await Document.findAll({
      where: filter,
      limit: size,
      order,
      include: [
        {
          model: User,
          as: 'uploaded_by',
          attributes: SAFE_USER_ATTRIBUTES,
        },
      ],
    });

    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Documents retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getDocuments:', error);
    return errorResponse(res, 'Failed to retrieve documents', 400, error);
  }
};

const getDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId, {
      include: [
        {
          model: User,
          as: 'uploaded_by',
          attributes: SAFE_USER_ATTRIBUTES,
        },
        {
          model: Document,
          as: 'versions',
          include: [{ model: User, as: 'uploaded_by', attributes: SAFE_USER_ATTRIBUTES }],
        },
      ],
    });

    if (!document) throw new ApiError(404, 'Document not found');

    const authorized = await canAccessDocument(req.user, document);
    if (!authorized) {
      await AuditService.logSecurityDenied({
        req,
        action: 'DOCUMENT_ACCESS_DENIED',
        resource: `DOCUMENT #${document.id}`,
      });
      throw new ApiError(403, 'Forbidden: You do not have permission to view this document');
    }

    return successResponse(res, document, 'Document retrieved successfully');
  } catch (error) {
    console.error('Error in getDocument:', error);
    return errorResponse(res, error.message || 'Failed to retrieve document', error.statusCode || 400, error);
  }
};

const downloadDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId);
    if (!document) throw new ApiError(404, 'Document not found');

    const authorized = await canAccessDocument(req.user, document);
    if (!authorized) {
      await AuditService.logSecurityDenied({
        req,
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        resource: `DOCUMENT #${document.id}`,
      });
      throw new ApiError(403, 'Forbidden: Access denied for file download');
    }

    // Resolve physical file
    const filename = path.basename(document.file_path);
    const fullPath = path.join(documentDir, filename);

    if (!fs.existsSync(fullPath)) {
      throw new ApiError(404, 'Document binary file not found on storage server');
    }

    // Record audit event for document download
    await AuditService.logDocument({
      req,
      action: 'DOCUMENT_DOWNLOAD',
      documentId: document.id,
      propertyId: document.property_id,
      summary: `User ${req.user.username} downloaded document "${document.title}"`,
      details: { original_name: document.original_name, file_size: document.file_size },
    });

    const isPreview = req.query.preview === 'true';
    const dispositionType = isPreview ? 'inline' : 'attachment';
    const downloadName = encodeURIComponent(document.original_name || document.title || 'document');

    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${downloadName}"`);
    if (document.file_size) {
      res.setHeader('Content-Length', document.file_size);
    }

    const stream = fs.createReadStream(fullPath);
    return stream.pipe(res);
  } catch (error) {
    console.error('Error in downloadDocument:', error);
    return errorResponse(res, error.message || 'Failed to download document', error.statusCode || 400, error);
  }
};

const updateDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId);
    if (!document) throw new ApiError(404, 'Document not found');

    const isStaff = ['ADMIN', 'OWNER'].includes(req.user.role);
    if (!isStaff && document.uploaded_by_id !== req.user.id) {
      throw new ApiError(403, 'Forbidden: Only the uploader or admin/owner can modify document metadata');
    }

    if (document.is_finalized && !isStaff) {
      throw new ApiError(400, 'Document has been finalized and cannot be modified');
    }

    const allowedUpdates = [
      'title',
      'description',
      'expiry_date',
      'access_scope',
      'status',
      'is_finalized',
      'is_archived',
    ];

    const previousState = {
      title: document.title,
      status: document.status,
      is_finalized: document.is_finalized,
      is_archived: document.is_archived,
    };

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        document[key] = req.body[key];
      }
    }

    await document.save();

    await AuditService.logDocument({
      req,
      action: 'DOCUMENT_UPDATE',
      documentId: document.id,
      propertyId: document.property_id,
      summary: `Updated document "${document.title}" metadata`,
      details: { before: previousState, after: req.body },
    });

    return successResponse(res, document, 'Document updated successfully');
  } catch (error) {
    console.error('Error in updateDocument:', error);
    return errorResponse(res, error.message || 'Failed to update document', error.statusCode || 400, error);
  }
};

const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.documentId);
    if (!document) throw new ApiError(404, 'Document not found');

    const isStaff = ['ADMIN', 'OWNER'].includes(req.user.role);
    if (!isStaff && document.uploaded_by_id !== req.user.id) {
      throw new ApiError(403, 'Forbidden: Only administrators or the uploader may delete this document');
    }

    if (document.is_finalized && !isStaff) {
      throw new ApiError(400, 'Finalized documents cannot be deleted');
    }

    const permanent = req.query.permanent === 'true' && isStaff;

    if (permanent) {
      // Remove physical file safely
      const filename = path.basename(document.file_path);
      const fullPath = path.join(documentDir, filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.warn('Could not delete physical file:', e.message);
        }
      }
      await document.destroy();

      await AuditService.logDocument({
        req,
        action: 'DOCUMENT_PERMANENT_DELETE',
        documentId: document.id,
        propertyId: document.property_id,
        summary: `Permanently deleted document "${document.title}" (ID #${document.id})`,
        severity: 'WARNING',
        details: { filename: document.original_name, checksum: document.checksum },
      });

      return successResponse(res, { id: document.id }, 'Document permanently deleted');
    } else {
      // Soft-archive
      document.is_archived = true;
      document.status = 'ARCHIVED';
      await document.save();

      await AuditService.logDocument({
        req,
        action: 'DOCUMENT_ARCHIVE',
        documentId: document.id,
        propertyId: document.property_id,
        summary: `Archived document "${document.title}" (ID #${document.id})`,
        details: { title: document.title },
      });

      return successResponse(res, document, 'Document archived successfully');
    }
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return errorResponse(res, error.message || 'Failed to delete document', error.statusCode || 400, error);
  }
};

module.exports = {
  createDocument,
  createDocumentVersion,
  getDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
};
