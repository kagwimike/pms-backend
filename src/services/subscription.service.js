const SubscriptionPlan = require('../models/SubscriptionPlan');
const WorkspaceSubscription = require('../models/WorkspaceSubscription');
const SubscriptionInvoice = require('../models/SubscriptionInvoice');
const Property = require('../models/Property');
const Unit = require('../models/Unit');
const User = require('../models/User');
const mpesa = require('./payments/mpesa.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const SubscriptionEmailService = require('./subscriptionEmail.service');
const { seedSubscriptionPlans } = require('../seeders/subscriptionPlans.seed');

class SubscriptionService {
  /**
   * Return all active subscription plans
   */
  async getPlans() {
    let plans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [['price_monthly_kes', 'ASC']],
    });

    if (!plans || plans.length === 0) {
      await seedSubscriptionPlans();
      plans = await SubscriptionPlan.findAll({
        where: { is_active: true },
        order: [['price_monthly_kes', 'ASC']],
      });
    }

    return plans;
  }

  /**
   * Get or initialize current subscription for an owner/agent workspace
   */
  async getCurrentSubscription(ownerId) {
    let sub = await WorkspaceSubscription.findOne({
      where: { owner_id: ownerId },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
    });

    // Auto-provision 14-day PRO trial if not found
    if (!sub) {
      sub = await this.createTrialSubscription(ownerId);
    }

    // Compute live usage metrics
    const properties = await Property.findAll({
      where: { owner_id: ownerId },
      attributes: ['id'],
    });
    const propertyIds = properties.map((p) => p.id);

    const unitsCount = propertyIds.length > 0 ? await Unit.count({ where: { property_id: propertyIds } }) : 0;
    const propertiesCount = properties.length;

    // Calculate days remaining
    const now = new Date();
    const targetDate = sub.status === 'TRIALING' && sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date(sub.current_period_end || sub.createdAt);
    const diffTime = targetDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const isExpired = diffTime < 0;
    // 5-day grace period
    const isGracePeriod = isExpired && Math.abs(diffTime) <= 5 * 24 * 60 * 60 * 1000;

    // Auto-update status if expired and not already marked
    if (isExpired && sub.status === 'TRIALING') {
      sub.status = 'EXPIRED';
      await sub.save();
    } else if (isGracePeriod && sub.status === 'ACTIVE') {
      sub.status = 'GRACE_PERIOD';
      await sub.save();
    } else if (isExpired && !isGracePeriod && sub.status === 'GRACE_PERIOD') {
      sub.status = 'EXPIRED';
      await sub.save();
    }

    // Automated email notifications for expiring trial or active subscription
    const lastNotified = sub.last_notification_sent_at ? new Date(sub.last_notification_sent_at).getTime() : 0;
    const hoursSinceLast = (now.getTime() - lastNotified) / (1000 * 60 * 60);

    if (hoursSinceLast >= 24) {
      try {
        const owner = await User.findByPk(ownerId);
        if (owner && owner.email) {
          if (sub.status === 'TRIALING' && daysRemaining <= 3 && daysRemaining > 0) {
            SubscriptionEmailService.sendTrialExpiringAlert(owner, sub, daysRemaining).catch(() => {});
            sub.last_notification_sent_at = now;
            sub.last_notification_type = `TRIAL_${daysRemaining}D`;
            await sub.save();
          } else if (sub.status === 'ACTIVE' && daysRemaining <= 5 && daysRemaining > 0) {
            SubscriptionEmailService.sendSubscriptionExpiringAlert(owner, sub, daysRemaining).catch(() => {});
            sub.last_notification_sent_at = now;
            sub.last_notification_type = `RENEWAL_${daysRemaining}D`;
            await sub.save();
          } else if ((isExpired || isGracePeriod) && sub.last_notification_type !== 'EXPIRED_ALERT') {
            SubscriptionEmailService.sendSubscriptionExpiredAlert(owner, sub).catch(() => {});
            sub.last_notification_sent_at = now;
            sub.last_notification_type = 'EXPIRED_ALERT';
            await sub.save();
          }
        }
      } catch (err) {
        logger.warn(`[SubscriptionService] Email notification error for owner ${ownerId}:`, err.message);
      }
    }

    const plan = sub.plan || (await SubscriptionPlan.findOne({ where: { code: sub.plan_code } }));
    const maxUnits = plan ? plan.max_units : 25;
    const maxStaff = plan ? plan.max_staff : 1;

    return {
      subscription: sub,
      plan,
      usage: {
        units_used: unitsCount,
        max_units: maxUnits,
        units_percentage: maxUnits > 0 ? Math.min(100, Math.round((unitsCount / maxUnits) * 100)) : 0,
        properties_count: propertiesCount,
        staff_used: 1, // Primary owner
        max_staff: maxStaff,
        sms_balance: sub.sms_balance || 0,
        days_remaining: daysRemaining,
        is_expired: isExpired,
        is_grace_period: isGracePeriod,
      },
    };
  }

  /**
   * Create a 14-day free trial on the Professional Agency plan
   */
  async createTrialSubscription(ownerId, planCode = 'PRO') {
    const plan = await SubscriptionPlan.findOne({ where: { code: planCode } });
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [sub] = await WorkspaceSubscription.findOrCreate({
      where: { owner_id: ownerId },
      defaults: {
        owner_id: ownerId,
        plan_id: plan ? plan.id : null,
        plan_code: planCode,
        status: 'TRIALING',
        billing_cycle: 'MONTHLY',
        trial_ends_at: trialEndsAt,
        current_period_start: now,
        current_period_end: trialEndsAt,
        sms_balance: plan ? plan.monthly_sms_quota : 500,
      },
    });

    return sub;
  }

  /**
   * Initiate subscription upgrade or renewal via M-Pesa STK push
   */
  async initiateMpesaSubscription(ownerId, { planCode, billingCycle = 'MONTHLY', phoneNumber }) {
    const plan = await SubscriptionPlan.findOne({ where: { code: planCode } });
    if (!plan) throw new ApiError(404, `Plan '${planCode}' not found`);

    const amount = billingCycle === 'ANNUAL' ? Number(plan.price_annual_kes) : Number(plan.price_monthly_kes);

    const invoiceNumber = `PMS-SUB-${Date.now().toString().slice(-6)}`;

    // Create a pending subscription invoice
    const invoice = await SubscriptionInvoice.create({
      invoice_number: invoiceNumber,
      owner_id: ownerId,
      plan_id: plan.id,
      plan_code: plan.code,
      billing_cycle: billingCycle,
      amount_kes: amount,
      payment_method: 'MPESA',
      phone_number: phoneNumber,
      status: 'PENDING',
    });

    let stkResult = null;
    let isSimulation = false;

    if (mpesa.isConfigured()) {
      try {
        stkResult = await mpesa.stkPush({
          phone: phoneNumber,
          amount,
          accountReference: invoiceNumber.slice(0, 12),
          description: `PMS ${plan.name}`.slice(0, 13),
        });

        invoice.checkout_request_id = stkResult.CheckoutRequestID;
        invoice.merchant_request_id = stkResult.MerchantRequestID;
        await invoice.save();
      } catch (err) {
        logger.warn(`M-Pesa STK push call failed (${err.message}). Falling back to simulation mode for sandbox/dev testing.`);
        isSimulation = true;
      }
    } else {
      isSimulation = true;
    }

    if (isSimulation) {
      invoice.checkout_request_id = `SIM-SUB-${Date.now()}`;
      invoice.merchant_request_id = `MER-SUB-${Date.now()}`;
      await invoice.save();
    }

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount_kes: amount,
      checkout_request_id: invoice.checkout_request_id,
      phone_number: phoneNumber,
      is_simulation: isSimulation,
      message: isSimulation
        ? 'Simulation: M-Pesa prompt simulated for development. Click Confirm Simulation to activate.'
        : `M-Pesa STK Push sent to ${phoneNumber}. Please enter your M-Pesa PIN on your phone.`,
    };
  }

  /**
   * Confirm or simulate successful subscription payment
   */
  async confirmSubscriptionPayment(invoiceId, mpesaReceiptNumber = null) {
    const invoice = await SubscriptionInvoice.findByPk(invoiceId);
    if (!invoice) throw new ApiError(404, 'Subscription invoice not found');

    if (invoice.status === 'PAID') {
      return { success: true, message: 'Invoice already paid', invoice };
    }

    const receipt = mpesaReceiptNumber || `SIM${Date.now().toString().slice(-8).toUpperCase()}`;

    invoice.status = 'PAID';
    invoice.transaction_reference = receipt;
    invoice.paid_at = new Date();
    await invoice.save();

    // Activate/Renew workspace subscription
    const sub = await WorkspaceSubscription.findOne({ where: { owner_id: invoice.owner_id } });
    const plan = await SubscriptionPlan.findByPk(invoice.plan_id);

    const now = new Date();
    const durationDays = invoice.billing_cycle === 'ANNUAL' ? 365 : 30;

    // If current subscription is active and has time remaining, append; otherwise start from now
    const baseDate = sub && sub.current_period_end && new Date(sub.current_period_end) > now ? new Date(sub.current_period_end) : now;

    const newPeriodEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    if (sub) {
      sub.plan_id = invoice.plan_id;
      sub.plan_code = invoice.plan_code;
      sub.status = 'ACTIVE';
      sub.billing_cycle = invoice.billing_cycle;
      sub.current_period_start = now;
      sub.current_period_end = newPeriodEnd;
      sub.last_payment_date = now;
      sub.mpesa_phone = invoice.phone_number;
      sub.sms_balance = (sub.sms_balance || 0) + (plan ? plan.monthly_sms_quota : 500);
      await sub.save();
    } else {
      await WorkspaceSubscription.create({
        owner_id: invoice.owner_id,
        plan_id: invoice.plan_id,
        plan_code: invoice.plan_code,
        status: 'ACTIVE',
        billing_cycle: invoice.billing_cycle,
        current_period_start: now,
        current_period_end: newPeriodEnd,
        last_payment_date: now,
        mpesa_phone: invoice.phone_number,
        sms_balance: plan ? plan.monthly_sms_quota : 500,
      });
    }

    const activeSub = await WorkspaceSubscription.findOne({
      where: { owner_id: invoice.owner_id },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
    });

    try {
      const owner = await User.findByPk(invoice.owner_id);
      if (owner && owner.email && activeSub) {
        SubscriptionEmailService.sendSubscriptionReceipt(owner, invoice, activeSub).catch(() => {});
      }
    } catch (e) {
      logger.warn('[SubscriptionService] Failed to send receipt email:', e.message);
    }

    logger.info(`Subscription activated successfully for owner_id=${invoice.owner_id}, plan=${invoice.plan_code}, expires=${newPeriodEnd.toISOString()}`);

    return {
      success: true,
      receipt_number: receipt,
      period_end: newPeriodEnd,
      invoice,
    };
  }

  /**
   * Automated batch scanner: Checks all workspaces and sends emails for trials or plans expiring in <= 3-5 days
   */
  async checkAndNotifyExpiringSubscriptions() {
    logger.info('[SubscriptionService] Running scheduled daily subscription expiration checks...');
    const subs = await WorkspaceSubscription.findAll({
      where: {
        status: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD'],
      },
      include: [
        { model: User, as: 'owner' },
        { model: SubscriptionPlan, as: 'plan' },
      ],
    });

    const now = new Date();
    let notifiedCount = 0;

    for (const sub of subs) {
      try {
        const targetDate = sub.status === 'TRIALING' && sub.trial_ends_at
          ? new Date(sub.trial_ends_at)
          : new Date(sub.current_period_end || sub.createdAt);
        const diffTime = targetDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const isExpired = diffTime < 0;

        const lastNotified = sub.last_notification_sent_at ? new Date(sub.last_notification_sent_at).getTime() : 0;
        const hoursSinceLast = (now.getTime() - lastNotified) / (1000 * 60 * 60);

        if (hoursSinceLast < 24) continue;

        if (sub.owner && sub.owner.email) {
          if (sub.status === 'TRIALING' && daysRemaining <= 3 && daysRemaining > 0) {
            await SubscriptionEmailService.sendTrialExpiringAlert(sub.owner, sub, daysRemaining);
            sub.last_notification_sent_at = now;
            sub.last_notification_type = `TRIAL_${daysRemaining}D`;
            await sub.save();
            notifiedCount++;
          } else if (sub.status === 'ACTIVE' && daysRemaining <= 5 && daysRemaining > 0) {
            await SubscriptionEmailService.sendSubscriptionExpiringAlert(sub.owner, sub, daysRemaining);
            sub.last_notification_sent_at = now;
            sub.last_notification_type = `RENEWAL_${daysRemaining}D`;
            await sub.save();
            notifiedCount++;
          } else if (isExpired && sub.last_notification_type !== 'EXPIRED_ALERT') {
            sub.status = 'EXPIRED';
            await SubscriptionEmailService.sendSubscriptionExpiredAlert(sub.owner, sub);
            sub.last_notification_sent_at = now;
            sub.last_notification_type = 'EXPIRED_ALERT';
            await sub.save();
            notifiedCount++;
          }
        }
      } catch (err) {
        logger.error(`[SubscriptionService] Error checking subscription ID ${sub.id}:`, err);
      }
    }

    logger.info(`[SubscriptionService] Expiration checks complete. Sent notifications to ${notifiedCount} workspaces.`);
    return { success: true, notifiedCount };
  }

  /**
   * Get past billing invoices
   */
  async getInvoices(ownerId) {
    return SubscriptionInvoice.findAll({
      where: { owner_id: ownerId },
      order: [['created_at', 'DESC']],
      include: [{ model: SubscriptionPlan, as: 'plan' }],
    });
  }
}

module.exports = new SubscriptionService();
