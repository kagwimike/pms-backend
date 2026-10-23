const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const SENSITIVE_KEYS = [
  'password',
  'current_password',
  'new_password',
  'confirm_password',
  'token',
  'access',
  'refresh',
  'authorization',
  'secret',
  'card_number',
  'cvv',
  'pin',
];

/**
 * Deep sanitization of details to ensure sensitive data is never logged to audit trails.
 */
function sanitizeDetails(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeDetails);

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeDetails(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

class AuditService {
  /**
   * Log an audit event with guaranteed resilience and sanitization.
   */
  static async logEvent({
    req = null,
    action,
    module = 'SYSTEM',
    entity_type = 'GENERAL',
    entity_id = null,
    summary = null,
    details = null,
    outcome = 'SUCCESS',
    severity = 'INFO',
    property_id = null,
    user_id = null,
    actor_role = null,
    ip_address = null,
    request_id = null,
    transaction = null,
  }) {
    try {
      if (!action) {
        logger.warn('AuditService: action is required to record audit event.');
        return null;
      }

      // Resolve actor from request if available
      const resolvedUserId = user_id || (req && req.user ? req.user.id : null);
      const resolvedRole = actor_role || (req && req.user ? req.user.role : null);
      const resolvedIp =
        ip_address ||
        (req
          ? req.ip ||
            req.headers['x-forwarded-for'] ||
            (req.connection && req.connection.remoteAddress) ||
            '127.0.0.1'
          : '127.0.0.1');
      const resolvedRequestId =
        request_id || (req && req.headers ? req.headers['x-request-id'] : null);

      // Clean & sanitize details
      const sanitizedDetails = details ? sanitizeDetails(details) : null;

      // Safe summary fallback
      const safeSummary =
        summary ||
        `${action} on ${entity_type}${entity_id ? ` #${entity_id}` : ''} [${outcome}]`;

      const auditEntry = await AuditLog.create(
        {
          action: String(action).toUpperCase().substring(0, 50),
          module: String(module).toUpperCase().substring(0, 50),
          entity_type: String(entity_type).toUpperCase().substring(0, 50),
          entity_id: entity_id ? Number(entity_id) : null,
          summary: String(safeSummary).substring(0, 255),
          outcome: ['SUCCESS', 'FAILURE', 'DENIED'].includes(outcome) ? outcome : 'SUCCESS',
          severity: ['INFO', 'WARNING', 'CRITICAL'].includes(severity) ? severity : 'INFO',
          actor_role: resolvedRole ? String(resolvedRole).substring(0, 50) : null,
          property_id: property_id ? Number(property_id) : null,
          request_id: resolvedRequestId ? String(resolvedRequestId).substring(0, 100) : null,
          details: sanitizedDetails,
          ip_address: resolvedIp ? String(resolvedIp).substring(0, 45) : '127.0.0.1',
          user_id: resolvedUserId,
        },
        transaction ? { transaction } : {}
      );

      return auditEntry;
    } catch (err) {
      // Never let an audit logging failure crash critical business operations
      logger.error('AuditService: Failed to record audit log:', err.message);
      return null;
    }
  }

  // --- Domain Helpers ---

  static async logAuth({ req, action, user, outcome = 'SUCCESS', severity = 'INFO', summary, details }) {
    return this.logEvent({
      req,
      action,
      module: 'AUTH',
      entity_type: 'USER',
      entity_id: user ? user.id : null,
      user_id: user ? user.id : null,
      actor_role: user ? user.role : null,
      outcome,
      severity,
      summary: summary || `Authentication event: ${action} (${outcome})`,
      details,
    });
  }

  static async logLease({ req, action, leaseId, propertyId, summary, details, outcome = 'SUCCESS' }) {
    return this.logEvent({
      req,
      action,
      module: 'LEASES',
      entity_type: 'LEASE',
      entity_id: leaseId,
      property_id: propertyId,
      summary: summary || `Lease event: ${action} on Lease #${leaseId}`,
      details,
      outcome,
    });
  }

  static async logFinance({ req, action, entityType, entityId, propertyId, summary, details, outcome = 'SUCCESS' }) {
    return this.logEvent({
      req,
      action,
      module: 'FINANCE',
      entity_type: entityType || 'PAYMENT',
      entity_id: entityId,
      property_id: propertyId,
      summary: summary || `Financial transaction: ${action} on ${entityType} #${entityId}`,
      details,
      outcome,
    });
  }

  static async logMaintenance({ req, action, requestId, propertyId, summary, details, outcome = 'SUCCESS' }) {
    return this.logEvent({
      req,
      action,
      module: 'MAINTENANCE',
      entity_type: 'MAINTENANCE_REQUEST',
      entity_id: requestId,
      property_id: propertyId,
      summary: summary || `Maintenance event: ${action} on Ticket #${requestId}`,
      details,
      outcome,
    });
  }

  static async logInspection({ req, action, inspectionId, propertyId, summary, details, outcome = 'SUCCESS' }) {
    return this.logEvent({
      req,
      action,
      module: 'INSPECTIONS',
      entity_type: 'INSPECTION',
      entity_id: inspectionId,
      property_id: propertyId,
      summary: summary || `Inspection event: ${action} on Inspection #${inspectionId}`,
      details,
      outcome,
    });
  }

  static async logDocument({ req, action, documentId, propertyId, summary, details, outcome = 'SUCCESS', severity = 'INFO' }) {
    return this.logEvent({
      req,
      action,
      module: 'DOCUMENTS',
      entity_type: 'DOCUMENT',
      entity_id: documentId,
      property_id: propertyId,
      summary: summary || `Document event: ${action} on Document #${documentId}`,
      details,
      outcome,
      severity,
    });
  }

  static async logSecurityDenied({ req, action, resource, details }) {
    return this.logEvent({
      req,
      action: action || 'UNAUTHORIZED_ACCESS_ATTEMPT',
      module: 'SECURITY',
      entity_type: resource || 'SYSTEM',
      outcome: 'DENIED',
      severity: 'WARNING',
      summary: `Unauthorized access denied for ${req.user ? req.user.username : 'Anonymous'} on ${req.originalUrl || resource}`,
      details,
    });
  }
}

module.exports = AuditService;
