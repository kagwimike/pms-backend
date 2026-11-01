const EmailDispatcher = require('./communication/dispatchers/email');
const NotificationService = require('./notification.service');
const logger = require('../utils/logger');
const env = require('../config/env');

class SubscriptionEmailService {
  /**
   * Send notification when 14-day free trial is nearing expiration
   */
  static async sendTrialExpiringAlert(user, sub, daysRemaining) {
    if (!user || !user.email) return;

    const subject = daysRemaining === 1
      ? '⚠️ Urgent: Your PMS Pro 14-Day Free Trial ends tomorrow!'
      : `Action Required: Your PMS Pro Free Trial ends in ${daysRemaining} days`;

    const htmlBody = this._getTrialExpiringTemplate({
      userName: user.first_name || user.username || 'Valued Property Manager',
      daysRemaining,
      planName: sub.plan?.name || 'Professional Agency',
      trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Soon',
      dashboardUrl: `${env.publicBaseUrl || 'http://localhost:5000'}/#/settings`,
      paybill: env.mpesa?.shortcode || '247247',
    });

    try {
      // 1. Dispatch Email
      await EmailDispatcher.send({
        recipientEmail: user.email,
        subject,
        htmlBody,
        logId: `SUB-TRIAL-WARN-${user.id}-${Date.now()}`,
      });

      // 2. Dispatch In-App Notification & WebSocket
      await NotificationService._createNotification(
        user.id,
        'SUBSCRIPTION_ALERT',
        `Free Trial Ends in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
        `Your 14-day Professional trial expires on ${sub.trial_ends_at ? new Date(sub.trial_ends_at).toDateString() : 'soon'}. Upgrade via M-Pesa to prevent interruption.`,
        '/settings'
      );

      logger.info(`[SubscriptionEmail] Trial expiring alert sent to ${user.email} (${daysRemaining} days left)`);
    } catch (err) {
      logger.error(`[SubscriptionEmail] Failed to send trial alert to ${user.email}:`, err);
    }
  }

  /**
   * Send notification when an active subscription is nearing expiration
   */
  static async sendSubscriptionExpiringAlert(user, sub, daysRemaining) {
    if (!user || !user.email) return;

    const planName = sub.plan?.name || 'Professional Agency';
    const renewalAmount = sub.billing_cycle === 'ANNUAL' ? sub.plan?.price_annual_kes || '65,000' : sub.plan?.price_monthly_kes || '6,500';

    const subject = daysRemaining === 1
      ? `⚠️ Reminder: Your PMS Pro ${planName} Plan renews tomorrow`
      : `Upcoming Renewal: Your PMS Pro ${planName} Plan renews in ${daysRemaining} days`;

    const htmlBody = this._getSubscriptionExpiringTemplate({
      userName: user.first_name || user.username || 'Valued Property Manager',
      daysRemaining,
      planName,
      renewalAmount,
      billingCycle: sub.billing_cycle || 'MONTHLY',
      periodEnd: sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Soon',
      dashboardUrl: `${env.publicBaseUrl || 'http://localhost:5000'}/#/settings`,
      paybill: env.mpesa?.shortcode || '247247',
    });

    try {
      await EmailDispatcher.send({
        recipientEmail: user.email,
        subject,
        htmlBody,
        logId: `SUB-RENEW-WARN-${user.id}-${Date.now()}`,
      });

      await NotificationService._createNotification(
        user.id,
        'SUBSCRIPTION_ALERT',
        `Subscription Renews in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
        `Your ${planName} subscription is ending on ${sub.current_period_end ? new Date(sub.current_period_end).toDateString() : 'soon'}. Renewal amount: KES ${renewalAmount}.`,
        '/settings'
      );

      logger.info(`[SubscriptionEmail] Renewal alert sent to ${user.email} (${daysRemaining} days remaining)`);
    } catch (err) {
      logger.error(`[SubscriptionEmail] Failed to send renewal alert to ${user.email}:`, err);
    }
  }

  /**
   * Send notification when subscription or trial has expired (entering 5-day grace period)
   */
  static async sendSubscriptionExpiredAlert(user, sub) {
    if (!user || !user.email) return;

    const planName = sub.plan?.name || 'Professional Agency';
    const subject = '⚠️ Your PMS Pro Plan Has Expired (5-Day Grace Period Active)';

    const htmlBody = this._getSubscriptionExpiredTemplate({
      userName: user.first_name || user.username || 'Valued Property Manager',
      planName,
      dashboardUrl: `${env.publicBaseUrl || 'http://localhost:5000'}/#/settings`,
      paybill: env.mpesa?.shortcode || '247247',
    });

    try {
      await EmailDispatcher.send({
        recipientEmail: user.email,
        subject,
        htmlBody,
        logId: `SUB-EXPIRED-${user.id}-${Date.now()}`,
      });

      await NotificationService._createNotification(
        user.id,
        'SUBSCRIPTION_EXPIRED',
        'Subscription Expired - Grace Period Active',
        `Your subscription has expired. You have a 5-day grace period to renew via M-Pesa before new unit creation is restricted.`,
        '/settings'
      );

      logger.info(`[SubscriptionEmail] Expiration notification sent to ${user.email}`);
    } catch (err) {
      logger.error(`[SubscriptionEmail] Failed to send expiration alert to ${user.email}:`, err);
    }
  }

  /**
   * Send payment confirmation and tax receipt email
   */
  static async sendSubscriptionReceipt(user, invoice, sub) {
    if (!user || !user.email) return;

    const subject = `Payment Received: PMS Pro Subscription Receipt (${invoice.invoice_number})`;

    const htmlBody = this._getPaymentReceiptTemplate({
      userName: user.first_name || user.username || 'Valued Property Manager',
      invoiceNumber: invoice.invoice_number,
      receiptNumber: invoice.transaction_reference || 'MPESA_REF',
      planName: sub.plan?.name || 'Professional Agency',
      billingCycle: invoice.billing_cycle || 'MONTHLY',
      amountKes: Number(invoice.amount_kes).toLocaleString('en-KE'),
      paidAt: new Date(invoice.paid_at || Date.now()).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }),
      nextRenewalDate: sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 days',
      dashboardUrl: `${env.publicBaseUrl || 'http://localhost:5000'}/#/settings`,
    });

    try {
      await EmailDispatcher.send({
        recipientEmail: user.email,
        subject,
        htmlBody,
        logId: `SUB-RECEIPT-${invoice.id}-${Date.now()}`,
      });

      await NotificationService._createNotification(
        user.id,
        'PAYMENT_RECEIVED',
        'Subscription Activated Successfully',
        `Payment of KES ${Number(invoice.amount_kes).toLocaleString()} received via M-Pesa (${invoice.transaction_reference}). Your workspace is active!`,
        '/settings'
      );
    } catch (err) {
      logger.error(`[SubscriptionEmail] Failed to send receipt to ${user.email}:`, err);
    }
  }

  // ─── Modern HTML Email Templates ───

  static _getTrialExpiringTemplate({ userName, daysRemaining, planName, trialEndsAt, dashboardUrl, paybill }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: #0F172A; padding: 28px 32px; text-align: left; border-bottom: 3px solid #27624D; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header span { color: #2A9D8F; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .body { padding: 32px; }
    .urgency-badge { display: inline-block; background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 20px; margin-bottom: 16px; }
    .metrics-box { background: #F1F5F9; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #E2E8F0; }
    .metric-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .metric-label { color: #64748B; }
    .metric-val { font-weight: 700; color: #0F172A; }
    .btn { display: block; text-align: center; background: #27624D; color: #ffffff !important; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 28px 0; }
    .mpesa-card { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; font-size: 13px; color: #166534; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span>PMS PRO • KENYA RENTAL MANAGEMENT</span>
      <h1>Subscription Status Update</h1>
    </div>
    <div class="body">
      <div class="urgency-badge">⏳ ${daysRemaining} DAY${daysRemaining > 1 ? 'S' : ''} REMAINING ON TRIAL</div>
      <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px;">Hi ${userName},</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #475569;">
        We hope you are enjoying managing your rental portfolio on PMS Pro. Your <strong>14-day free trial on the ${planName} Plan</strong> will conclude on <strong>${trialEndsAt}</strong>.
      </p>
      <div class="metrics-box">
        <div class="metric-row">
          <span class="metric-label">Current Plan</span>
          <span class="metric-val">${planName}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Trial Expiration</span>
          <span class="metric-val" style="color: #D97706;">${trialEndsAt}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Active Capacity</span>
          <span class="metric-val">Up to 100 Rental Units</span>
        </div>
        <div class="metric-row" style="margin-bottom: 0;">
          <span class="metric-label">M-Pesa Automation</span>
          <span class="metric-val" style="color: #16A34A;">Active (C2B Paybill & Till)</span>
        </div>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        To avoid any interruption in automated M-Pesa rent reconciliation, tenant portal access, and KRA 7.5% MRI export, activate your subscription today:
      </p>
      <a href="${dashboardUrl}" class="btn">Upgrade & Renew with M-Pesa</a>
      <div class="mpesa-card">
        <strong>📱 Pay Seamlessly via M-Pesa STK Push:</strong><br>
        Open Settings in your workspace &gt; Subscription &amp; Billing, select your preferred plan, enter your Safaricom number, and approve the instant PIN prompt on your phone.
      </div>
    </div>
    <div class="footer">
      PMS Pro Kenya • Nairobi, Kenya • Need assistance? WhatsApp +254 702 263 303<br>
      © ${new Date().getFullYear()} PMS Pro. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;
  }

  static _getSubscriptionExpiringTemplate({ userName, daysRemaining, planName, renewalAmount, billingCycle, periodEnd, dashboardUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: #0F172A; padding: 28px 32px; border-bottom: 3px solid #27624D; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; }
    .body { padding: 32px; }
    .btn { display: block; text-align: center; background: #27624D; color: #ffffff !important; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 28px 0; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span style="color: #2A9D8F; font-size: 13px; font-weight: 600; text-transform: uppercase;">PMS PRO SUBSCRIPTION</span>
      <h1>Upcoming Subscription Renewal</h1>
    </div>
    <div class="body">
      <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px;">Hi ${userName},</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #475569;">
        Your <strong>${planName} Plan</strong> (${billingCycle.toLowerCase()} cycle) will conclude on <strong>${periodEnd}</strong> (${daysRemaining} days remaining).
      </p>
      <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748B;">Renewal Amount:</span>
          <strong style="color: #0F172A;">KES ${renewalAmount}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748B;">Renewal Date:</span>
          <strong>${periodEnd}</strong>
        </div>
      </div>
      <a href="${dashboardUrl}" class="btn">Renew Subscription Now</a>
    </div>
    <div class="footer">
      PMS Pro Kenya • Questions? Contact support@pmspro.co.ke
    </div>
  </div>
</body>
</html>
    `;
  }

  static _getSubscriptionExpiredTemplate({ userName, planName, dashboardUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; }
    .header { background: #7F1D1D; padding: 28px 32px; color: #ffffff; }
    .body { padding: 32px; color: #1E293B; }
    .btn { display: block; text-align: center; background: #27624D; color: #ffffff !important; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 700; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">Subscription Expired • Grace Period Active</h1>
    </div>
    <div class="body">
      <h2>Hi ${userName},</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #475569;">
        Your PMS Pro <strong>${planName}</strong> plan has ended. You have been placed on a <strong>5-day courtesy grace period</strong>.
      </p>
      <p style="font-size: 14px; color: #475569;">
        During this grace period, your tenants can still access their portal and pay rent, but adding new units and exporting tax schedules will be locked once the grace period ends.
      </p>
      <a href="${dashboardUrl}" class="btn">Re-activate Your Workspace Now</a>
    </div>
  </div>
</body>
</html>
    `;
  }

  static _getPaymentReceiptTemplate({ userName, invoiceNumber, receiptNumber, planName, billingCycle, amountKes, paidAt, nextRenewalDate, dashboardUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; }
    .header { background: #064E3B; padding: 28px 32px; color: #ffffff; }
    .body { padding: 32px; color: #1E293B; }
    .receipt-box { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span style="color: #6EE7B7; font-size: 12px; font-weight: 700; text-transform: uppercase;">TAX INVOICE & RECEIPT</span>
      <h1 style="margin: 4px 0 0 0; font-size: 20px;">Payment Received • KES ${amountKes}</h1>
    </div>
    <div class="body">
      <h2>Thank you, ${userName}!</h2>
      <p style="color: #475569; font-size: 14px;">Your payment for PMS Pro has been processed successfully via M-Pesa.</p>
      <div class="receipt-box">
        <p style="margin: 4px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p style="margin: 4px 0;"><strong>M-Pesa Reference:</strong> ${receiptNumber}</p>
        <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName} (${billingCycle})</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${paidAt}</p>
        <p style="margin: 4px 0;"><strong>Next Renewal:</strong> ${nextRenewalDate}</p>
      </div>
      <p style="font-size: 14px; color: #16A34A; font-weight: 600;">✓ Your workspace limits and features are active.</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

module.exports = SubscriptionEmailService;
