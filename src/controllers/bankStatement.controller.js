const path = require('path');
const BankStatementUpload = require('../models/BankStatementUpload');
const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const { processBankStatement } = require('../services/payments/bankStatement.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const AuditService = require('../services/audit.service');

const uploadAndReconcile = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No statement file uploaded. Please upload a CSV or Excel file.', 400);
    }

    const { bank_account_id } = req.body;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    const result = await processBankStatement({
      fileBuffer,
      fileName,
      bankAccountId: bank_account_id ? parseInt(bank_account_id, 10) : null,
      uploadedByUserId: req.user.id,
    });

    await AuditService.logEvent({
      req,
      action: 'BANK_STATEMENT_UPLOADED',
      module: 'FINANCE',
      entity_type: 'BANK_STATEMENT',
      entity_id: result.uploadId,
      summary: `Uploaded and parsed bank statement: ${fileName}. Matched: ${result.matchedCount}, Unmatched: ${result.unmatchedCount}, Duplicates: ${result.duplicateCount}`,
      outcome: 'SUCCESS',
      details: {
        totalRows: result.totalRows,
        totalAmount: result.totalAmount,
        matchedCount: result.matchedCount,
        unmatchedCount: result.unmatchedCount,
      },
    });

    return successResponse(res, result, 'Bank statement processed and reconciled successfully', 201);
  } catch (error) {
    console.error('Error processing bank statement:', error);
    return errorResponse(res, error.message || 'Failed to process bank statement', 500, error);
  }
};

const getStatementUploads = async (req, res) => {
  try {
    const { bank_account_id, page = 1, limit = 20 } = req.query;
    const where = {};
    if (bank_account_id) where.bank_account_id = bank_account_id;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await BankStatementUpload.findAndCountAll({
      where,
      include: [
        {
          model: BankAccount,
          as: 'bank_account',
          attributes: ['id', 'bank_name', 'account_name', 'account_number', 'paybill_number'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    return successResponse(
      res,
      {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
        statements: rows,
      },
      'Statement upload history retrieved successfully'
    );
  } catch (error) {
    return errorResponse(res, 'Failed to fetch statement upload history', 500, error);
  }
};

const getStatementUploadById = async (req, res) => {
  try {
    const upload = await BankStatementUpload.findByPk(req.params.id, {
      include: [
        {
          model: BankAccount,
          as: 'bank_account',
          attributes: ['id', 'bank_name', 'account_name', 'account_number', 'paybill_number'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'email'],
        },
      ],
    });

    if (!upload) {
      return errorResponse(res, 'Statement upload record not found', 404);
    }

    return successResponse(res, upload, 'Statement upload details retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve statement details', 500, error);
  }
};

module.exports = {
  uploadAndReconcile,
  getStatementUploads,
  getStatementUploadById,
};
