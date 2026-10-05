/**
 * Safaricom Daraja (M-Pesa) client.
 *
 * Supports:
 *  - OAuth token (cached)
 *  - STK Push (Lipa na M-Pesa Online) + STK query
 *  - C2B URL registration (Paybill payments made directly from the phone)
 *  - Parsing of STK callback & C2B confirmation payloads
 *
 * Uses Node's global fetch (Node >= 18). No credentials => isConfigured() === false.
 */
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

let cachedToken = null;
let tokenExpiresAt = 0;

const cfg = () => env.mpesa;
const baseUrl = () => BASE_URLS[cfg().env] || BASE_URLS.sandbox;

const isConfigured = () => {
  const c = cfg();
  return Boolean(c.consumerKey && c.consumerSecret && c.shortcode && c.passkey);
};

const withToken = (url) => {
  const token = cfg().callbackToken;
  if (!token) return url;
  return url + (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
};

const callbackUrl = () => {
  if (cfg().callbackUrl) return withToken(cfg().callbackUrl);
  if (!env.publicBaseUrl) return '';
  return withToken(`${env.publicBaseUrl.replace(/\/$/, '')}/api/finance/payments/mpesa/callback`);
};

/** Normalise Kenyan numbers to 2547XXXXXXXX / 2541XXXXXXXX */
const normalizePhone = (phone) => {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (p.length === 9 && (p.startsWith('7') || p.startsWith('1'))) p = '254' + p;
  if (!/^254(7|1)\d{8}$/.test(p)) return null;
  return p;
};

const timestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const getAccessToken = async () => {
  if (!isConfigured()) throw new ApiError(503, 'M-Pesa is not configured on this server');
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const auth = Buffer.from(`${cfg().consumerKey}:${cfg().consumerSecret}`).toString('base64');
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new ApiError(502, `M-Pesa auth failed (${res.status})`);
  }
  const body = await res.json();
  cachedToken = body.access_token;
  // Refresh a minute before expiry
  tokenExpiresAt = Date.now() + (Number(body.expires_in || 3599) - 60) * 1000;
  return cachedToken;
};

const darajaPost = async (path, payload) => {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.errorMessage || body.ResponseDescription || `M-Pesa request failed (${res.status})`;
    throw new ApiError(502, msg);
  }
  return body;
};

/**
 * Initiate STK push. Returns { MerchantRequestID, CheckoutRequestID, ResponseCode, CustomerMessage }
 */
const stkPush = async ({ phone, amount, accountReference, description }) => {
  const msisdn = normalizePhone(phone);
  if (!msisdn) throw new ApiError(400, 'Invalid M-Pesa phone number. Use format 07XXXXXXXX or 2547XXXXXXXX');
  const cb = callbackUrl();
  if (!cb) throw new ApiError(503, 'M-Pesa callback URL is not configured (set PUBLIC_BASE_URL or MPESA_CALLBACK_URL)');

  const ts = timestamp();
  const password = Buffer.from(`${cfg().shortcode}${cfg().passkey}${ts}`).toString('base64');

  return darajaPost('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: cfg().shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: cfg().transactionType,
    Amount: Math.ceil(Number(amount)), // Daraja accepts whole shillings only
    PartyA: msisdn,
    PartyB: cfg().shortcode,
    PhoneNumber: msisdn,
    CallBackURL: cb,
    AccountReference: String(accountReference || 'RENT').slice(0, 12),
    TransactionDesc: String(description || 'Rent payment').slice(0, 13),
  });
};

const stkQuery = async (checkoutRequestId) => {
  const ts = timestamp();
  const password = Buffer.from(`${cfg().shortcode}${cfg().passkey}${ts}`).toString('base64');
  return darajaPost('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: cfg().shortcode,
    Password: password,
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId,
  });
};

/** Register C2B validation/confirmation URLs (run once per shortcode) */
const registerC2BUrls = async () => {
  if (!env.publicBaseUrl) throw new ApiError(503, 'PUBLIC_BASE_URL is required to register C2B URLs');
  const base = `${env.publicBaseUrl.replace(/\/$/, '')}/api/finance/payments/mpesa/c2b`;
  return darajaPost('/mpesa/c2b/v1/registerurl', {
    ShortCode: cfg().c2bShortcode,
    ResponseType: 'Completed',
    ConfirmationURL: withToken(`${base}/confirmation`),
    ValidationURL: withToken(`${base}/validation`),
  });
};

/**
 * Parse the STK callback body:
 * { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata: { Item: [...] } } } }
 */
const parseStkCallback = (body) => {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  const items = cb.CallbackMetadata?.Item || [];
  const get = (name) => items.find((i) => i.Name === name)?.Value;
  return {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc,
    success: Number(cb.ResultCode) === 0,
    amount: get('Amount'),
    receipt: get('MpesaReceiptNumber'),
    phone: get('PhoneNumber') ? String(get('PhoneNumber')) : null,
    transactionDate: get('TransactionDate'),
  };
};

/** Parse C2B confirmation payload (Paybill payments initiated from the phone) */
const parseC2B = (body) => ({
  receipt: body.TransID,
  amount: Number(body.TransAmount),
  accountReference: body.BillRefNumber,
  phone: body.MSISDN ? String(body.MSISDN) : null,
  payerName: [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(' ') || null,
  transactionTime: body.TransTime,
  shortcode: body.BusinessShortCode,
});

const verifyCallbackToken = (req) => {
  const expected = cfg().callbackToken;
  if (!expected) return true; // token check disabled
  return req.query.token === expected;
};

module.exports = {
  isConfigured,
  normalizePhone,
  getAccessToken,
  stkPush,
  stkQuery,
  registerC2BUrls,
  parseStkCallback,
  parseC2B,
  verifyCallbackToken,
  callbackUrl,
};
