/**
 * Payment reconciliation: the single place where money is applied to invoices.
 *
 * Every channel (manual entry, M-Pesa STK, M-Pesa C2B Paybill, bank IPN) ends up here so
 * invoice balances and notifications stay consistent. Invoice balances are always
 * recomputed from CONFIRMED payments (never incremented blindly), which makes
 * reversals/refunds and duplicate callbacks safe.
 */
const { Op } = require('sequelize');
const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Lease = require('../../models/Lease');
const Unit = require('../../models/Unit');
const Property = require('../../models/Property');
const User = require('../../models/User');
const NotificationService = require('../notification.service');
const { normalizePhone } = require('./mpesa.service');
const logger = require('../../utils/logger');

/** Account reference format shown to tenants for Paybill / bank deposits */
const invoiceReference = (invoiceId) => `INV-${invoiceId}`;

/** Recompute amount_paid + status of an invoice from its CONFIRMED payments */
const recalcInvoice = async (invoiceId) => {
  if (!invoiceId) return null;
  const invoice = await Invoice.findByPk(invoiceId);
  if (!invoice || invoice.status === 'CANCELLED') return invoice;

  const paid = Number(
    (await Payment.sum('amount', { where: { invoice_id: invoiceId, status: 'CONFIRMED' } })) || 0
  );
  const total = Number(invoice.amount);
  const today = new Date().toISOString().slice(0, 10);

  invoice.amount_paid = paid.toFixed(2);
  if (paid >= total) invoice.status = 'PAID';
  else if (paid > 0) invoice.status = 'PARTIAL';
  else invoice.status = invoice.due_date < today ? 'OVERDUE' : 'PENDING';

  await invoice.save();
  return invoice;
};

/** Accepts "INV-12", "inv 12", "#12", "12" */
const findInvoiceByReference = async (ref) => {
  if (!ref) return null;
  const m = String(ref).trim().match(/^(?:INV[-\s#]?|#)?(\d+)$/i);
  if (!m) return null;
  return Invoice.findByPk(m[1]);
};

const findTenantByPhone = async (phone) => {
  const p = normalizePhone(phone);
  if (!p) return null;
  const local = '0' + p.slice(3);
  return User.findOne({
    where: { role: 'TENANT', phone: { [Op.in]: [p, `+${p}`, local] } },
  });
};

/** Owners of the property where the tenant currently (or most recently) leases */
const ownerIdsForTenant = async (tenantId) => {
  if (!tenantId) return [];
  const leases = await Lease.findAll({
    where: { tenant_id: tenantId },
    include: [{ model: Unit, as: 'unit', include: [{ model: Property, as: 'property', attributes: ['owner_id'] }] }],
  });
  return [...new Set(leases.map((l) => l.unit?.property?.owner_id).filter(Boolean))];
};

const staffIds = async (tenantId) => {
  const owners = await ownerIdsForTenant(tenantId);
  const admins = await User.findAll({ where: { role: 'ADMIN' }, attributes: ['id'] });
  return [...new Set([...owners, ...admins.map((a) => a.id)])];
};

const notifyStaffUnmatched = async (payment, tenantId) => {
  const recipients = tenantId ? await staffIds(tenantId) : (await User.findAll({ where: { role: { [Op.in]: ['ADMIN', 'OWNER'] } }, attributes: ['id'] })).map((u) => u.id);
  for (const id of recipients) {
    await NotificationService.notifyPaymentUnmatchedStaff(id, payment.amount, payment.transaction_reference || 'N/A', payment.id);
  }
};

/** Mark a payment CONFIRMED, apply it to its invoice and notify */
const confirmPayment = async (payment, { receipt, phone, raw } = {}) => {
  if (payment.status === 'CONFIRMED') return payment; // idempotent
  if (receipt && !payment.transaction_reference) payment.transaction_reference = receipt;
  if (phone && !payment.phone_number) payment.phone_number = phone;
  if (raw) payment.gateway_response = raw;
  payment.status = 'CONFIRMED';
  payment.is_confirmed = true;
  await payment.save();

  await recalcInvoice(payment.invoice_id);
  if (payment.tenant_id) {
    await NotificationService.notifyPaymentReceived(payment.tenant_id, payment.amount, payment.invoice_id);
  }
  return payment;
};

const failPayment = async (payment, reason, raw) => {
  if (['FAILED', 'CONFIRMED'].includes(payment.status)) return payment;
  payment.status = 'FAILED';
  payment.is_confirmed = false;
  payment.notes = reason || payment.notes;
  if (raw) payment.gateway_response = raw;
  await payment.save();
  if (payment.tenant_id) {
    await NotificationService.notifyPaymentFailed(payment.tenant_id, payment.amount);
  }
  return payment;
};

/**
 * Money arrived from an external channel (C2B Paybill, bank IPN).
 * Idempotent on transaction reference. Matches by account reference (INV-<id>),
 * falls back to UNMATCHED for manual reconciliation.
 */
const recordIncomingPayment = async ({ method, amount, reference, accountReference, phone, payerName, raw }) => {
  if (reference) {
    const existing = await Payment.findOne({ where: { transaction_reference: reference } });
    if (existing) return { payment: existing, duplicate: true };
  }

  const invoice = await findInvoiceByReference(accountReference);
  const usableInvoice = invoice && invoice.status !== 'CANCELLED' ? invoice : null;
  const tenant = usableInvoice?.tenant_id ? null : await findTenantByPhone(phone);
  const tenantId = usableInvoice?.tenant_id || tenant?.id || null;

  const payment = await Payment.create({
    amount,
    payment_method: method,
    transaction_reference: reference || null,
    account_reference: accountReference || null,
    phone_number: normalizePhone(phone) || phone || null,
    payer_name: payerName || null,
    gateway_response: raw || null,
    invoice_id: usableInvoice?.id || null,
    tenant_id: tenantId,
    status: usableInvoice ? 'PENDING' : 'UNMATCHED',
  });

  if (usableInvoice) {
    await confirmPayment(payment);
  } else {
    logger.warn(`Unmatched ${method} payment ${reference} (account ref: ${accountReference})`);
    if (tenantId) {
      await NotificationService.notifyPaymentUnmatched(tenantId, amount, reference || 'N/A');
    }
    await notifyStaffUnmatched(payment, tenantId);
  }
  return { payment, duplicate: false };
};

/** Manually attach an UNMATCHED / PENDING payment to an invoice and confirm it */
const matchPayment = async (payment, invoice) => {
  payment.invoice_id = invoice.id;
  payment.tenant_id = invoice.tenant_id || payment.tenant_id;
  payment.status = 'PENDING';
  await payment.save();
  return confirmPayment(payment);
};

module.exports = {
  invoiceReference,
  recalcInvoice,
  findInvoiceByReference,
  findTenantByPhone,
  ownerIdsForTenant,
  confirmPayment,
  failPayment,
  recordIncomingPayment,
  matchPayment,
};
