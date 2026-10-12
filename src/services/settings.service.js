const SystemSetting = require('../models/SystemSetting');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Property = require('../models/Property');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const mpesa = require('./payments/mpesa.service');

// Default global policies
const DEFAULT_SETTINGS = {
  ORGANIZATION: {
    name: 'PMS Pro Real Estate',
    legal_name: 'PMS Pro Properties Ltd',
    registration_number: 'CPR/2024/09123',
    tax_pin: 'P051234567Z',
    email: 'info@pmspro.co.ke',
    phone: '+254700000000',
    address: 'Kilimani Business Centre, Nairobi',
    city: 'Nairobi',
    country: 'Kenya',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
  },
  RENTAL: {
    billing_frequency: 'MONTHLY',
    rent_due_day: 5, // 5th of every month
    grace_period_days: 5,
    late_fee_type: 'PERCENTAGE', // FIXED or PERCENTAGE
    late_fee_amount: 5, // 5% or 500 KES
    lease_renewal_reminder_days: 30,
    deposit_multiplier: 1.0,
    service_charge_billing: 'INCLUDED',
    meter_reading_cutoff_day: 28,
  },
  FINANCE: {
    invoice_prefix: 'INV-',
    receipt_prefix: 'RCT-',
    default_payment_method: 'MPESA',
    allow_partial_payments: true,
    min_partial_payment: 100,
    require_deposit_approval: true,
    auto_reconciliation: true,
    tax_rate: 0.0,
  },
  NOTIFICATIONS: {
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    rent_reminder_days_before: [3, 1],
    send_payment_receipts: true,
    send_overdue_notices: true,
    overdue_grace_days: 2,
    maintenance_status_alerts: true,
    inspection_notifications: true,
  },
  INTEGRATIONS: {
    mpesa_configured: false,
    mpesa_env: 'sandbox',
    mpesa_shortcode: '174379',
    mpesa_consumer_key_masked: '******',
    bank_configured: false,
    bank_name: 'Kenya Commercial Bank (KCB)',
    sms_provider: 'AfricasTalking',
    sms_sender_id: 'PMSPRO',
  },
  SECURITY: {
    two_factor_auth_required: false,
    session_timeout_minutes: 60,
    password_expiry_days: 90,
    require_special_char: true,
    lockout_attempts: 5,
  },
};

/**
 * Mask sensitive values
 */
const maskSecret = (val) => {
  if (!val || typeof val !== 'string') return '******';
  if (val.length <= 4) return '****';
  return val.slice(0, 2) + '******' + val.slice(-2);
};

class SettingsService {
  /**
   * Resolve setting value with scope hierarchy:
   * Property Override -> Org/Global -> Default
   */
  static async getResolvedSetting(category, propertyId = null) {
    const defaults = DEFAULT_SETTINGS[category] || {};

    // 1. Fetch Global setting
    const globalSetting = await SystemSetting.findOne({
      where: { scope: 'GLOBAL', category, settings_key: 'config' },
    });
    let resolved = { ...defaults, ...(globalSetting?.settings_value || {}) };

    // 2. Fetch Property override if propertyId provided
    if (propertyId) {
      const propertySetting = await SystemSetting.findOne({
        where: { scope: 'PROPERTY', scope_id: propertyId, category, settings_key: 'config' },
      });
      if (propertySetting && propertySetting.settings_value) {
        resolved = { ...resolved, ...propertySetting.settings_value, is_property_override: true };
      }
    }

    // Dynamic runtime evaluation for integrations
    if (category === 'INTEGRATIONS') {
      resolved.mpesa_configured = mpesa.isConfigured();
      resolved.mpesa_env = env.mpesa.env;
      resolved.mpesa_shortcode = env.mpesa.shortcode ? maskSecret(env.mpesa.shortcode) : 'Not configured';
      resolved.bank_configured = Boolean(env.bank.paybill || env.bank.accountNumber);
      resolved.bank_name = env.bank.name;
    }

    return resolved;
  }

  /**
   * Save or update setting
   */
  static async updateSetting({ scope = 'GLOBAL', scope_id = null, category, value, userId, ipAddress }) {
    if (!DEFAULT_SETTINGS[category] && category !== 'USER') {
      throw new ApiError(400, `Unsupported settings category: ${category}`);
    }

    // Authorization guard for property scope
    if (scope === 'PROPERTY') {
      if (!scope_id) throw new ApiError(400, 'Property ID is required for property-level settings');
      const property = await Property.findByPk(scope_id);
      if (!property) throw new ApiError(404, 'Property not found');
    }

    const [settingRecord, created] = await SystemSetting.findOrCreate({
      where: { scope, scope_id: scope_id || null, category, settings_key: 'config' },
      defaults: {
        settings_value: value,
        updated_by: userId,
      },
    });

    const previousValue = settingRecord.settings_value;

    if (!created) {
      settingRecord.settings_value = { ...settingRecord.settings_value, ...value };
      settingRecord.updated_by = userId;
      await settingRecord.save();
    }

    // Write to AuditLog for transparency & compliance
    try {
      await AuditLog.create({
        action: created ? 'SETTINGS_CREATE' : 'SETTINGS_UPDATE',
        entity_type: `SETTINGS_${category}`,
        entity_id: settingRecord.id,
        details: {
          scope,
          scope_id,
          category,
          updated_fields: Object.keys(value),
          before: previousValue,
          after: settingRecord.settings_value,
        },
        ip_address: ipAddress || '127.0.0.1',
        user_id: userId,
      });
    } catch (auditErr) {
      console.error('AuditLog error in SettingsService:', auditErr);
    }

    return settingRecord.settings_value;
  }

  /**
   * Get personal user preferences
   */
  static async getUserPreferences(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const setting = await SystemSetting.findOne({
      where: { scope: 'USER', scope_id: userId, category: 'APPEARANCE', settings_key: 'preferences' },
    });

    const defaults = {
      theme: 'system',
      language: 'en',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      currency: 'KES',
      email_alerts: true,
      push_alerts: true,
      sms_alerts: false,
    };

    return {
      user_id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      gender: user.gender,
      role: user.role,
      profile_picture: user.profile_picture,
      preferences: { ...defaults, ...(setting?.settings_value || {}) },
    };
  }

  /**
   * Update personal user preferences
   */
  static async updateUserPreferences(userId, preferences) {
    const [settingRecord] = await SystemSetting.findOrCreate({
      where: { scope: 'USER', scope_id: userId, category: 'APPEARANCE', settings_key: 'preferences' },
      defaults: {
        settings_value: preferences,
        updated_by: userId,
      },
    });

    settingRecord.settings_value = { ...settingRecord.settings_value, ...preferences };
    settingRecord.updated_by = userId;
    await settingRecord.save();

    return settingRecord.settings_value;
  }

  /**
   * Update personal user profile safely (prevent privilege escalation)
   */
  static async updateUserProfile(userId, profileData, ipAddress) {
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, 'User not found');

    // Only allow editable safe fields
    const safeFields = ['first_name', 'last_name', 'phone', 'gender', 'profile_picture'];
    const updates = {};
    for (const key of safeFields) {
      if (profileData[key] !== undefined) {
        updates[key] = profileData[key];
      }
    }

    const previousProfile = {
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      gender: user.gender,
    };

    Object.assign(user, updates);
    await user.save();

    try {
      await AuditLog.create({
        action: 'PROFILE_UPDATE',
        entity_type: 'USER',
        entity_id: user.id,
        details: { before: previousProfile, after: updates },
        ip_address: ipAddress || '127.0.0.1',
        user_id: user.id,
      });
    } catch (e) {}

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      gender: user.gender,
      role: user.role,
      profile_picture: user.profile_picture,
    };
  }

  /**
   * Change user password securely
   */
  static async changePassword(userId, currentPassword, newPassword, ipAddress) {
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const isMatch = await user.isPasswordMatch(currentPassword);
    if (!isMatch) {
      throw new ApiError(400, 'Current password does not match.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new ApiError(400, 'New password must be at least 6 characters.');
    }

    user.password = newPassword;
    await user.save(); // hooks will re-hash password

    try {
      await AuditLog.create({
        action: 'PASSWORD_CHANGE',
        entity_type: 'USER',
        entity_id: user.id,
        details: { status: 'SUCCESS' },
        ip_address: ipAddress || '127.0.0.1',
        user_id: user.id,
      });
    } catch (e) {}

    return true;
  }
}

module.exports = SettingsService;
