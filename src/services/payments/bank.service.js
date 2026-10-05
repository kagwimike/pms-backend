/**
 * Generic bank integration.
 *
 * Banks (Equity, KCB, Co-op, NCBA, etc.) push "instant payment notifications" (IPN)
 * to a webhook when money lands in the collection account. Payload formats differ per
 * bank, so this module:
 *   1. Verifies an HMAC-SHA256 signature of the raw body (BANK_WEBHOOK_SECRET)
 *   2. Normalises common field names into one shape for reconciliation
 *
 * Adapting to a specific bank = extend `normalize()` with that bank's field names.
 */
const crypto = require('crypto');
const env = require('../../config/env');

const isConfigured = () => Boolean(env.bank.webhookSecret);

const verifySignature = (req) => {
  const secret = env.bank.webhookSecret;
  if (!secret) return false;
  const provided = req.headers[env.bank.signatureHeader];
  if (!provided || !req.rawBody) return false;

  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const a = Buffer.from(String(provided).replace(/^sha256=/, ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
};

/** Normalise a bank IPN into { reference, amount, accountReference, payerName, phone, transactionDate } */
const normalize = (body = {}) => ({
  reference: pick(body, ['transaction_reference', 'transactionReference', 'TransactionReference', 'reference', 'tranRef', 'bank_reference']),
  amount: Number(pick(body, ['amount', 'Amount', 'transactionAmount', 'TransAmount']) || 0),
  accountReference: pick(body, ['account_reference', 'accountReference', 'BillRefNumber', 'narration', 'Narration', 'customerReference']),
  payerName: pick(body, ['payer_name', 'payerName', 'customerName', 'CustomerName', 'debitAccountName']),
  phone: pick(body, ['phone', 'phoneNumber', 'MSISDN', 'msisdn']),
  transactionDate: pick(body, ['transaction_date', 'transactionDate', 'TransTime', 'valueDate']),
});

const publicDetails = () => ({
  name: env.bank.name,
  paybill: env.bank.paybill || null,
  account_number: env.bank.accountNumber || null,
});

module.exports = { isConfigured, verifySignature, normalize, publicDetails };
