const BankAccount = require('../models/BankAccount');
const Property = require('../models/Property');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const AuditService = require('../services/audit.service');

const getBankAccounts = async (req, res) => {
  try {
    const { property_id, is_active } = req.query;
    const where = {};
    if (property_id) where.property_id = property_id;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const accounts = await BankAccount.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'address'],
        },
      ],
      order: [
        ['is_primary', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    return successResponse(res, accounts, 'Bank accounts retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve bank accounts', 500, error);
  }
};

const getBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByPk(req.params.id, {
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'address'],
        },
      ],
    });
    if (!account) {
      return errorResponse(res, 'Bank account not found', 404);
    }
    return successResponse(res, account, 'Bank account retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to fetch bank account', 500, error);
  }
};

const createBankAccount = async (req, res) => {
  try {
    const {
      property_id,
      bank_name,
      account_name,
      account_number,
      bank_code,
      branch_code,
      branch_name,
      paybill_number,
      currency,
      is_primary,
      webhook_secret,
      notes,
    } = req.body;

    if (!account_name || !account_number) {
      return errorResponse(res, 'Account name and account number are required', 400);
    }

    // If marked primary, unset other primary accounts
    if (is_primary) {
      await BankAccount.update(
        { is_primary: false },
        { where: property_id ? { property_id } : {} }
      );
    }

    const account = await BankAccount.create({
      property_id: property_id || null,
      bank_name: bank_name || 'EQUITY',
      account_name,
      account_number,
      bank_code: bank_code || null,
      branch_code: branch_code || null,
      branch_name: branch_name || null,
      paybill_number: paybill_number || null,
      currency: currency || 'KES',
      is_primary: Boolean(is_primary),
      webhook_secret: webhook_secret || null,
      notes: notes || null,
      created_by: req.user?.id || null,
    });

    await AuditService.logEvent({
      req,
      action: 'BANK_ACCOUNT_CREATED',
      module: 'FINANCE',
      entity_type: 'BANK_ACCOUNT',
      entity_id: account.id,
      summary: `Created bank collection account: ${account_name} (${bank_name} - ${account_number})`,
      outcome: 'SUCCESS',
    });

    return successResponse(res, account, 'Bank account created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create bank account', 500, error);
  }
};

const updateBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByPk(req.params.id);
    if (!account) {
      return errorResponse(res, 'Bank account not found', 404);
    }

    if (req.body.is_primary && !account.is_primary) {
      await BankAccount.update(
        { is_primary: false },
        { where: account.property_id ? { property_id: account.property_id } : {} }
      );
    }

    await account.update(req.body);

    await AuditService.logEvent({
      req,
      action: 'BANK_ACCOUNT_UPDATED',
      module: 'FINANCE',
      entity_type: 'BANK_ACCOUNT',
      entity_id: account.id,
      summary: `Updated bank collection account: ${account.account_name}`,
      outcome: 'SUCCESS',
    });

    return successResponse(res, account, 'Bank account updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update bank account', 500, error);
  }
};

const deleteBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByPk(req.params.id);
    if (!account) {
      return errorResponse(res, 'Bank account not found', 404);
    }

    await account.destroy();

    await AuditService.logEvent({
      req,
      action: 'BANK_ACCOUNT_DELETED',
      module: 'FINANCE',
      entity_type: 'BANK_ACCOUNT',
      entity_id: req.params.id,
      summary: `Deleted bank account: ${account.account_name} (${account.account_number})`,
      outcome: 'SUCCESS',
    });

    return successResponse(res, null, 'Bank account deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete bank account', 500, error);
  }
};

const setPrimaryBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByPk(req.params.id);
    if (!account) {
      return errorResponse(res, 'Bank account not found', 404);
    }

    await BankAccount.update(
      { is_primary: false },
      { where: account.property_id ? { property_id: account.property_id } : {} }
    );

    account.is_primary = true;
    await account.save();

    return successResponse(res, account, 'Default bank account updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to set default bank account', 500, error);
  }
};

const getSupportedBanks = (req, res) => {
  const banks = [
    { code: 'EQUITY', name: 'Equity Bank Kenya', defaultPaybill: '247247', bankCode: '68' },
    { code: 'COOP', name: 'Co-operative Bank of Kenya', defaultPaybill: '400200', bankCode: '11' },
    { code: 'KCB', name: 'KCB Bank Kenya', defaultPaybill: '522522', bankCode: '01' },
    { code: 'NCBA', name: 'NCBA Bank Kenya', defaultPaybill: '888888', bankCode: '07' },
    { code: 'STANBIC', name: 'Stanbic Bank Kenya', defaultPaybill: '600100', bankCode: '31' },
    { code: 'ABSA', name: 'Absa Bank Kenya', defaultPaybill: '303030', bankCode: '03' },
    { code: 'DTB', name: 'Diamond Trust Bank (DTB)', defaultPaybill: '516600', bankCode: '63' },
    { code: 'IM_BANK', name: 'I&M Bank Kenya', defaultPaybill: '542542', bankCode: '57' },
    { code: 'STANDARD_CHARTERED', name: 'Standard Chartered Bank', defaultPaybill: '329329', bankCode: '02' },
    { code: 'FAMILY_BANK', name: 'Family Bank', defaultPaybill: '222111', bankCode: '70' },
    { code: 'OTHER', name: 'Other Financial Institution', defaultPaybill: null, bankCode: null },
  ];
  return successResponse(res, banks, 'Supported Kenyan banks retrieved successfully');
};

module.exports = {
  getBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
  getSupportedBanks,
};
