const Inspection = require('../models/Inspection');
const Damage = require('../models/Damage');
const Lease = require('../models/Lease');
const User = require('../models/User');
const Unit = require('../models/Unit');
const Property = require('../models/Property');
const DepositRefund = require('../models/DepositRefund');
const Invoice = require('../models/Invoice');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');
const NotificationService = require('../services/notification.service');
const { DEFAULT_ITEM_CATALOG, STANDARD_CHECKLIST_SECTIONS } = require('../config/inspectionCatalog');

// Helper to include full rich context for an inspection
const inspectionIncludes = [
  {
    model: Lease,
    as: 'lease',
    include: [
      {
        model: Unit,
        as: 'unit',
        include: [{ model: Property, as: 'property', attributes: ['id', 'name', 'address'] }]
      },
      {
        model: User,
        as: 'tenant',
        attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'phone']
      }
    ]
  },
  {
    model: User,
    as: 'inspector',
    attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'role']
  },
  {
    model: Damage,
    as: 'damages'
  }
];

// ==================== CATALOG & CHECKLIST TEMPLATE ====================

const getPricingCatalog = async (req, res) => {
  try {
    return successResponse(res, {
      catalog: DEFAULT_ITEM_CATALOG,
      default_checklist: STANDARD_CHECKLIST_SECTIONS
    }, 'Inspection pricing catalog retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to fetch catalog', 500, error);
  }
};

// ==================== INSPECTION CRUD ====================

const createInspection = async (req, res) => {
  try {
    const { lease_id, inspection_type, date, checklist, notes } = req.body;
    if (!lease_id) throw new ApiError(400, 'Lease ID is required');

    const lease = await Lease.findByPk(lease_id, {
      include: [
        { model: Unit, as: 'unit' },
        { model: User, as: 'tenant' }
      ]
    });
    if (!lease) throw new ApiError(404, 'Lease not found');

    // Use passed checklist or default templates
    const initialChecklist = checklist || STANDARD_CHECKLIST_SECTIONS;

    const inspection = await Inspection.create({
      lease_id,
      inspection_type: inspection_type || 'ROUTINE',
      status: req.body.status || 'SCHEDULED',
      date: date || new Date(),
      notes: notes || null,
      checklist: initialChecklist,
      condition_score: req.body.condition_score !== undefined ? req.body.condition_score : 100,
      inspector_id: req.user.id
    });

    // Notify tenant
    try {
      await NotificationService.notifyInspectionScheduled(lease.tenant_id, inspection.date, inspection.id);
      const EventBus = require('../services/communication/eventBus');
      await EventBus.publishCommunicationEvent('INSPECTION_SCHEDULED', {
        recipientId: lease.tenant_id,
        entityType: 'INSPECTION',
        entityId: inspection.id,
        customVars: { date: inspection.date, type: inspection.inspection_type }
      });
    } catch (e) {}

    const fullInspection = await Inspection.findByPk(inspection.id, { include: inspectionIncludes });
    return successResponse(res, fullInspection, 'Inspection created successfully', 201);
  } catch (error) {
    console.error('Error in createInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create inspection', statusCode, error);
  }
};

const getInspections = async (req, res) => {
  try {
    const { limit, cursor, lease_id, inspection_type, status } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);

    if (lease_id) where.lease_id = lease_id;
    if (inspection_type) where.inspection_type = inspection_type;
    if (status) where.status = status;

    // Role-based access control
    if (req.user.role === 'TENANT') {
      const tenantLeases = await Lease.findAll({
        where: { tenant_id: req.user.id },
        attributes: ['id']
      });
      const leaseIds = tenantLeases.map(l => l.id);
      where.lease_id = leaseIds;
    }

    const data = await Inspection.findAll({
      where,
      include: inspectionIncludes,
      limit: size,
      order: order || [['date', 'DESC'], ['id', 'DESC']]
    });

    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Inspections retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getInspections:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve inspections', statusCode, error);
  }
};

const getInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId, {
      include: inspectionIncludes
    });
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    if (req.user.role === 'TENANT') {
      if (!inspection.lease || inspection.lease.tenant_id !== req.user.id) {
        throw new ApiError(403, 'Not authorized to view this inspection');
      }
    }

    return successResponse(res, inspection, 'Inspection retrieved successfully');
  } catch (error) {
    console.error('Error in getInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve inspection', statusCode, error);
  }
};

const updateInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId);
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    const oldStatus = inspection.status;
    Object.assign(inspection, req.body);
    await inspection.save();

    if (req.body.status === 'COMPLETED' && oldStatus !== 'COMPLETED' && inspection.lease_id) {
      const lease = await Lease.findByPk(inspection.lease_id);
      if (lease) {
        try {
          await NotificationService.notifyInspectionCompleted(lease.tenant_id, inspection.id);
        } catch (e) {}
      }
    }

    const updated = await Inspection.findByPk(inspection.id, { include: inspectionIncludes });
    return successResponse(res, updated, 'Inspection updated successfully');
  } catch (error) {
    console.error('Error in updateInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update inspection', statusCode, error);
  }
};

const deleteInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.inspectionId);
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    await Damage.destroy({ where: { inspection_id: inspection.id } });
    await inspection.destroy();
    return successResponse(res, null, 'Inspection deleted successfully', 200);
  } catch (error) {
    console.error('Error in deleteInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete inspection', statusCode, error);
  }
};

// ==================== DAMAGE & BROKEN ITEMS CONTROLLERS ====================

const createDamage = async (req, res) => {
  try {
    const inspectionId = req.params.inspectionId || req.body.inspection_id || req.body.inspectionId;
    if (!inspectionId) throw new ApiError(400, 'Inspection ID is required');

    const inspection = await Inspection.findByPk(inspectionId, {
      include: [{ model: Lease, as: 'lease' }]
    });
    if (!inspection) throw new ApiError(404, 'Inspection not found');

    const { item_name, condition, quantity, unit_price, description, photo, charge_target } = req.body;
    const qty = parseInt(quantity || 1, 10);
    const price = parseFloat(unit_price || 0.0);
    const calculatedCost = req.body.cost !== undefined ? parseFloat(req.body.cost) : (qty * price);

    const damage = await Damage.create({
      inspection_id: inspectionId,
      item_name: item_name || 'Broken / Damaged Item',
      condition: condition || 'BROKEN',
      quantity: qty,
      unit_price: price,
      cost: calculatedCost,
      description: description || `${item_name || 'Item'} damaged during tenancy`,
      photo: photo || null,
      charge_target: charge_target || 'TENANT_DEPOSIT',
      resolved: false
    });

    // Recalculate total deductions for this inspection
    const allDamages = await Damage.findAll({ where: { inspection_id: inspectionId } });
    const depositDamagesTotal = allDamages
      .filter(d => d.charge_target === 'TENANT_DEPOSIT')
      .reduce((sum, d) => sum + parseFloat(d.cost || 0), 0);

    inspection.total_deductions = depositDamagesTotal;
    await inspection.save();

    if (inspection.lease) {
      try {
        await NotificationService.notifyDamageReported(inspection.lease.tenant_id, damage.description, inspection.id);
      } catch (e) {}
    }

    return successResponse(res, damage, 'Damage item recorded successfully', 201);
  } catch (error) {
    console.error('Error in createDamage:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create damage record', statusCode, error);
  }
};

const getDamagesByInspection = async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const damages = await Damage.findAll({ where: { inspection_id: inspectionId } });
    return successResponse(res, damages, 'Damages retrieved successfully');
  } catch (error) {
    console.error('Error in getDamagesByInspection:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve damages', statusCode, error);
  }
};

const deleteDamage = async (req, res) => {
  try {
    const { damageId } = req.params;
    const damage = await Damage.findByPk(damageId);
    if (!damage) throw new ApiError(404, 'Damage record not found');

    const inspectionId = damage.inspection_id;
    await damage.destroy();

    // Recalculate total deductions
    const allDamages = await Damage.findAll({ where: { inspection_id: inspectionId } });
    const depositDamagesTotal = allDamages
      .filter(d => d.charge_target === 'TENANT_DEPOSIT')
      .reduce((sum, d) => sum + parseFloat(d.cost || 0), 0);

    await Inspection.update({ total_deductions: depositDamagesTotal }, { where: { id: inspectionId } });

    return successResponse(res, null, 'Damage record removed successfully', 200);
  } catch (error) {
    console.error('Error in deleteDamage:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete damage record', statusCode, error);
  }
};

// ==================== DEPOSIT RECONCILIATION & DEDUCTIONS ====================

/**
 * Calculates the exact move-out deposit reconciliation:
 * - Lease original deposit held
 * - Deductions calculated from all broken/missing checklist items
 * - Unpaid invoices or rent arrears (if any)
 * - Net amount eligible for refund to tenant
 * - Overage / Deficit if damages exceed the deposit
 */
const calculateDepositDeductions = async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const inspection = await Inspection.findByPk(inspectionId, {
      include: [
        {
          model: Lease,
          as: 'lease',
          include: [
            { model: Unit, as: 'unit', include: ['property'] },
            { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }
          ]
        },
        { model: Damage, as: 'damages' }
      ]
    });

    if (!inspection) throw new ApiError(404, 'Inspection not found');
    const lease = inspection.lease;
    if (!lease) throw new ApiError(400, 'Inspection is not linked to an active or terminated lease');

    const depositHeld = parseFloat(lease.deposit_amount || 0);

    // Sum all damage items allocated to TENANT_DEPOSIT
    const damages = inspection.damages || [];
    const itemizedDeductions = damages
      .filter(d => d.charge_target === 'TENANT_DEPOSIT')
      .map(d => ({
        id: d.id,
        item_name: d.item_name || 'Damage Repair',
        condition: d.condition || 'BROKEN',
        quantity: d.quantity || 1,
        unit_price: parseFloat(d.unit_price || 0),
        cost: parseFloat(d.cost || 0),
        description: d.description,
        photo: d.photo
      }));

    const totalDamageDeduction = itemizedDeductions.reduce((sum, d) => sum + d.cost, 0);

    // Check for outstanding invoices on this lease
    const unpaidInvoices = await Invoice.findAll({
      where: {
        lease_id: lease.id,
        status: ['PENDING', 'PARTIAL', 'OVERDUE']
      }
    });

    let totalUnpaidRentAndBills = 0;
    const itemizedArrears = unpaidInvoices.map(inv => {
      const balance = parseFloat(inv.amount || 0) - parseFloat(inv.amount_paid || 0);
      totalUnpaidRentAndBills += balance;
      return {
        invoice_id: inv.id,
        type: inv.invoice_type,
        due_date: inv.due_date,
        balance
      };
    });

    const totalDeductions = totalDamageDeduction + totalUnpaidRentAndBills;
    const netRefund = Math.max(0, depositHeld - totalDeductions);
    const tenantOwesDeficit = Math.max(0, totalDeductions - depositHeld);

    // Save calculation snapshot to inspection
    inspection.total_deductions = totalDamageDeduction;
    if (inspection.refund_status === 'NONE') {
      inspection.refund_status = 'CALCULATED';
    }
    await inspection.save();

    const result = {
      inspection_id: inspection.id,
      inspection_type: inspection.inspection_type,
      lease_id: lease.id,
      unit_name: lease.unit ? `${lease.unit.unit_number} (${lease.unit.property ? lease.unit.property.name : ''})` : 'Unit',
      tenant: lease.tenant ? {
        id: lease.tenant.id,
        name: `${lease.tenant.first_name || ''} ${lease.tenant.last_name || ''}`.trim(),
        email: lease.tenant.email,
        phone: lease.tenant.phone
      } : null,
      deposit_held: depositHeld,
      total_damage_deductions: totalDamageDeduction,
      total_unpaid_bills: totalUnpaidRentAndBills,
      total_deductions: totalDeductions,
      net_refund_amount: netRefund,
      tenant_deficit_owing: tenantOwesDeficit,
      refund_status: inspection.refund_status,
      itemized_deductions: itemizedDeductions,
      itemized_arrears: itemizedArrears
    };

    return successResponse(res, result, 'Deposit deductions calculated successfully', 200);
  } catch (error) {
    console.error('Error in calculateDepositDeductions:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to calculate deposit deductions', statusCode, error);
  }
};

/**
 * Finalize move-out deposit reconciliation:
 * - Records official DepositRefund entry
 * - Optionally creates an invoice for tenant deficit or marks lease terminated
 * - Vacates the unit if move-out inspection
 */
const finalizeDepositRefund = async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const {
      amount_refunded,
      deductions_retained,
      payment_method,
      transaction_reference,
      notes,
      vacate_unit_now,
      terminate_lease_now
    } = req.body;

    const inspection = await Inspection.findByPk(inspectionId, {
      include: [
        { model: Lease, as: 'lease', include: ['unit', 'tenant'] },
        { model: Damage, as: 'damages' }
      ]
    });
    if (!inspection) throw new ApiError(404, 'Inspection not found');
    const lease = inspection.lease;
    if (!lease) throw new ApiError(400, 'Inspection lease not found');

    const refundAmount = parseFloat(amount_refunded || 0);
    const deductions = parseFloat(deductions_retained || inspection.total_deductions || 0);

    // Create official deposit refund audit log
    const refundRecord = await DepositRefund.create({
      lease_id: lease.id,
      amount_refunded: refundAmount,
      deductions_retained: deductions,
      payment_method: payment_method || 'MPESA',
      transaction_reference: transaction_reference || `DEP-REF-${Date.now()}`,
      notes: notes || `Deposit reconciliation for Inspection #${inspection.id} (${inspection.inspection_type})`,
      processed_by_id: req.user.id
    });

    // Update inspection status
    inspection.deposit_refunded = refundAmount;
    inspection.total_deductions = deductions;
    inspection.status = 'COMPLETED';
    inspection.refund_status = refundAmount > 0 ? 'REFUNDED' : 'FORFEITED';
    await inspection.save();

    // Mark unit VACANT if requested
    if (vacate_unit_now && lease.unit_id) {
      await Unit.update({ status: 'VACANT' }, { where: { id: lease.unit_id } });
    }

    // Terminate lease if requested
    if (terminate_lease_now) {
      await Lease.update({ status: 'TERMINATED' }, { where: { id: lease.id } });
    }

    // Notify tenant of deposit settlement
    try {
      const EventBus = require('../services/communication/eventBus');
      await EventBus.publishCommunicationEvent('DEPOSIT_REFUND_PROCESSED', {
        recipientId: lease.tenant_id,
        entityType: 'INSPECTION',
        entityId: inspection.id,
        customVars: {
          refundAmount: refundAmount.toFixed(2),
          deductions: deductions.toFixed(2),
          ref: refundRecord.transaction_reference
        }
      });
    } catch (e) {}

    const updated = await Inspection.findByPk(inspection.id, { include: inspectionIncludes });
    return successResponse(res, {
      inspection: updated,
      refund: refundRecord
    }, 'Deposit reconciliation finalized successfully', 200);
  } catch (error) {
    console.error('Error in finalizeDepositRefund:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to finalize deposit refund', statusCode, error);
  }
};

module.exports = {
  getPricingCatalog,
  createInspection,
  getInspections,
  getInspection,
  updateInspection,
  deleteInspection,
  createDamage,
  getDamagesByInspection,
  deleteDamage,
  calculateDepositDeductions,
  finalizeDepositRefund
};