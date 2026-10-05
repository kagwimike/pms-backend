const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  /**
   * Internal method to create a notification
   */
  static async _createNotification(recipientId, type, title, message, link = null) {
    try {
      const notification = await Notification.create({
        recipient_id: recipientId,
        type,
        title,
        message,
        link,
      });
      return notification;
    } catch (error) {
      console.error(`Failed to create notification of type ${type}:`, error);
      return null;
    }
  }

  // --- Payment & Invoice Notifications ---

  static async notifyPaymentReceived(tenantId, amount, invoiceId) {
    return this._createNotification(
      tenantId,
      'PAYMENT_RECEIVED',
      'Payment Received',
      `Your payment of KSh ${amount} has been received successfully.`,
      `/invoices/${invoiceId}`
    );
  }

  static async notifyPaymentFailed(tenantId, amount) {
    return this._createNotification(
      tenantId,
      'PAYMENT_FAILED',
      'Payment Failed',
      `Your attempted payment of KSh ${amount} failed. Please try again or contact support.`,
      '/payments'
    );
  }

  static async notifyPaymentReversed(tenantId, amount) {
    return this._createNotification(
      tenantId,
      'PAYMENT_REVERSED',
      'Payment Reversed',
      `Your payment of KSh ${amount} has been reversed.`,
      '/payments'
    );
  }

  static async notifyPaymentRefunded(tenantId, amount) {
    return this._createNotification(
      tenantId,
      'PAYMENT_REFUNDED',
      'Payment Refunded',
      `A refund of KSh ${amount} has been processed to your account.`,
      '/payments'
    );
  }

  static async notifyPaymentUnmatched(tenantId, amount, reference) {
    return this._createNotification(
      tenantId,
      'PAYMENT_UNMATCHED',
      'Unmatched Payment',
      `We received a payment of KSh ${amount} (Ref: ${reference}), but couldn't match it to an invoice. Please contact support.`,
      '/payments'
    );
  }

  static async notifyPaymentUnmatchedStaff(staffId, amount, reference, paymentId) {
    return this._createNotification(
      staffId,
      'PAYMENT_UNMATCHED',
      'Unmatched Payment Needs Review',
      `A payment of KSh ${amount} (Ref: ${reference}) could not be matched to any invoice. Match it from Payments.`,
      `/payments/${paymentId}`
    );
  }

  static async notifyInvoiceCreated(tenantId, amount, invoiceId) {
    return this._createNotification(
      tenantId,
      'INVOICE_CREATED',
      'New Invoice Created',
      `A new invoice for KSh ${amount} has been generated for your account.`,
      `/invoices/${invoiceId}`
    );
  }

  static async notifyInvoiceDueSoon(tenantId, amount, invoiceId) {
    return this._createNotification(
      tenantId,
      'INVOICE_DUE_SOON',
      'Invoice Due Soon',
      `Your invoice for KSh ${amount} is due soon. Please ensure payment to avoid late fees.`,
      `/invoices/${invoiceId}`
    );
  }

  static async notifyInvoiceOverdue(tenantId, amount, invoiceId) {
    return this._createNotification(
      tenantId,
      'INVOICE_OVERDUE',
      'Invoice Overdue',
      `Your invoice for KSh ${amount} is now overdue. Please process payment immediately.`,
      `/invoices/${invoiceId}`
    );
  }

  // --- Lease Notifications ---

  static async notifyLeaseCreated(tenantId, unitNumber) {
    return this._createNotification(
      tenantId,
      'LEASE_CREATED',
      'Lease Created',
      `A new lease agreement for Unit ${unitNumber} has been created and activated.`,
      '/lease'
    );
  }

  static async notifyLeaseExpiring(tenantId, unitNumber, daysLeft) {
    return this._createNotification(
      tenantId,
      'LEASE_EXPIRING',
      'Lease Expiring Soon',
      `Your lease for Unit ${unitNumber} is expiring in ${daysLeft} days. Contact management to renew.`,
      '/lease'
    );
  }

  static async notifyLeaseExpired(tenantId, unitNumber) {
    return this._createNotification(
      tenantId,
      'LEASE_EXPIRED',
      'Lease Expired',
      `Your lease for Unit ${unitNumber} has officially expired.`,
      '/lease'
    );
  }

  static async notifyLeaseRenewed(tenantId, unitNumber) {
    return this._createNotification(
      tenantId,
      'LEASE_RENEWED',
      'Lease Renewed',
      `Your lease for Unit ${unitNumber} has been successfully renewed.`,
      '/lease'
    );
  }

  static async notifyLeaseRenewalReminder(tenantId, unitNumber) {
    return this._createNotification(
      tenantId,
      'LEASE_RENEWAL_REMINDER',
      'Lease Renewal Reminder',
      `Reminder: Your lease for Unit ${unitNumber} is expiring soon. Would you like to renew?`,
      '/lease'
    );
  }

  // --- Maintenance Notifications ---

  static async notifyMaintenanceCreated(tenantId, ticketTitle, ticketId) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_CREATED',
      'Maintenance Request Received',
      `We have received your maintenance request: "${ticketTitle}".`,
      `/maintenance/${ticketId}`
    );
  }

  static async notifyMaintenanceAssigned(tenantId, ticketTitle, ticketId) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_ASSIGNED',
      'Maintenance Assigned',
      `A vendor has been assigned to your maintenance request: "${ticketTitle}".`,
      `/maintenance/${ticketId}`
    );
  }

  static async notifyMaintenanceUpdated(tenantId, ticketTitle, ticketId, status) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_UPDATED',
      'Maintenance Status Updated',
      `The status of your maintenance request "${ticketTitle}" has been updated to ${status}.`,
      `/maintenance/${ticketId}`
    );
  }

  static async notifyMaintenanceCompleted(tenantId, ticketTitle, ticketId) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_COMPLETED',
      'Maintenance Completed',
      `Your maintenance request "${ticketTitle}" has been marked as completed.`,
      `/maintenance/${ticketId}`
    );
  }

  static async notifyMaintenanceSlaWarning(tenantId, ticketTitle, ticketId) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_SLA_WARNING',
      'Maintenance SLA Warning',
      `Warning: Maintenance request "${ticketTitle}" is approaching its SLA deadline.`,
      `/maintenance/${ticketId}`
    );
  }

  static async notifyMaintenanceSlaBreached(tenantId, ticketTitle, ticketId) {
    return this._createNotification(
      tenantId,
      'MAINTENANCE_SLA_BREACHED',
      'Maintenance SLA Breached',
      `Alert: Maintenance request "${ticketTitle}" has breached its SLA deadline.`,
      `/maintenance/${ticketId}`
    );
  }

  // --- Inspection Notifications ---

  static async notifyInspectionScheduled(tenantId, dateStr, inspectionId) {
    return this._createNotification(
      tenantId,
      'INSPECTION_SCHEDULED',
      'Inspection Scheduled',
      `A property inspection has been scheduled for ${dateStr}.`,
      `/inspections/${inspectionId}`
    );
  }

  static async notifyInspectionCompleted(tenantId, inspectionId) {
    return this._createNotification(
      tenantId,
      'INSPECTION_COMPLETED',
      'Inspection Completed',
      `The recent property inspection has been completed.`,
      `/inspections/${inspectionId}`
    );
  }

  static async notifyDamageReported(tenantId, description, inspectionId) {
    return this._createNotification(
      tenantId,
      'DAMAGE_REPORTED',
      'Damage Reported',
      `Damage has been reported during an inspection: "${description}".`,
      `/inspections/${inspectionId}`
    );
  }

  // --- Document Notifications ---

  static async notifyDocumentExpiring(tenantId, docName) {
    return this._createNotification(
      tenantId,
      'DOCUMENT_EXPIRING',
      'Document Expiring Soon',
      `Your document "${docName}" is expiring soon. Please upload a renewed copy.`,
      '/documents'
    );
  }

  // --- Property/Unit Notifications ---

  static async notifyUnitVacant(ownerId, unitNumber) {
    return this._createNotification(
      ownerId,
      'UNIT_VACANT',
      'Unit Vacant',
      `Unit ${unitNumber} is now vacant and ready for listing.`,
      '/units'
    );
  }

  static async notifyUnitOccupied(ownerId, unitNumber) {
    return this._createNotification(
      ownerId,
      'UNIT_OCCUPIED',
      'Unit Occupied',
      `Unit ${unitNumber} is now occupied.`,
      '/units'
    );
  }

  // --- General/Admin Notifications ---

  static async notifyTenantCreated(tenantId, propertyName) {
    return this._createNotification(
      tenantId,
      'TENANT_CREATED',
      'Welcome to PMS Pro',
      `Your tenant account for ${propertyName || 'our properties'} has been created successfully. Welcome!`,
      '/profile'
    );
  }

  static async notifyAnnouncement(tenantId, title, message) {
    return this._createNotification(
      tenantId,
      'ANNOUNCEMENT_CREATED',
      `Announcement: ${title}`,
      message,
      '/announcements'
    );
  }
}

module.exports = NotificationService;
