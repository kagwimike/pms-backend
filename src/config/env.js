const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../../.env") });

module.exports = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
 

  dbHost: process.env.DB_HOST,
  dbPort: process.env.DB_PORT,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,

  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: process.env.REDIS_PORT || 6379,
  redisPassword: process.env.REDIS_PASSWORD || "",

  // Public base URL of this API (used to build gateway callback URLs)
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",

  // ─── M-Pesa (Safaricom Daraja) ───
  mpesa: {
    env: process.env.MPESA_ENV || "sandbox", // sandbox | production
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortcode: process.env.MPESA_SHORTCODE || "", // Paybill / Till used for STK
    passkey: process.env.MPESA_PASSKEY || "",
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline", // or CustomerBuyGoodsOnline
    callbackUrl: process.env.MPESA_CALLBACK_URL || "", // defaults to {PUBLIC_BASE_URL}/api/finance/payments/mpesa/callback
    c2bShortcode: process.env.MPESA_C2B_SHORTCODE || process.env.MPESA_SHORTCODE || "",
    // Optional shared token appended as ?token= to callback URLs for basic authenticity checks
    callbackToken: process.env.MPESA_CALLBACK_TOKEN || "",
  },

  // ─── Bank integration (generic signed webhook) ───
  bank: {
    name: process.env.BANK_NAME || "Bank",
    paybill: process.env.BANK_PAYBILL || "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    webhookSecret: process.env.BANK_WEBHOOK_SECRET || "", // HMAC-SHA256 secret
    signatureHeader: (process.env.BANK_SIGNATURE_HEADER || "x-bank-signature").toLowerCase(),
  },
};
