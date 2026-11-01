const subscriptionService = require('../services/subscription.service');
const ApiError = require('../utils/ApiError');

/**
 * Middleware to enforce subscription unit quotas before creating new units
 */
const checkUnitQuota = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new ApiError(401, 'Please authenticate'));
    }

    // Admins have unrestricted access
    if (user.role === 'ADMIN' || user.is_superuser) {
      return next();
    }

    // Determine the workspace owner ID (for AGENT/OWNER or associated staff)
    const ownerId = user.owner_id || user.id;

    const subData = await subscriptionService.getCurrentSubscription(ownerId);
    const sub = subData.subscription;
    const plan = sub?.plan;

    if (!sub || !plan) {
      return next();
    }

    // Check expiration status
    if (sub.status === 'EXPIRED') {
      return res.status(403).json({
        success: false,
        message: 'Your PMS Pro subscription has expired. Please renew or upgrade your plan in Settings > Subscription & Billing to add more units.',
        code: 'SUBSCRIPTION_EXPIRED',
        requires_upgrade: true,
      });
    }

    // Check unit capacity
    const maxUnits = plan.max_units || 25;
    const currentUnits = subData.usage?.units_used || 0;

    if (currentUnits >= maxUnits) {
      return res.status(403).json({
        success: false,
        message: `Plan limit reached: You have ${currentUnits} of ${maxUnits} units on your ${plan.name} plan. Upgrade to the next tier to add more units.`,
        code: 'UNIT_QUOTA_EXCEEDED',
        requires_upgrade: true,
        max_units: maxUnits,
        units_used: currentUnits,
      });
    }

    next();
  } catch (error) {
    console.error('Subscription quota check error:', error);
    // Don't block system operation on edge errors, allow proceed
    next();
  }
};

/**
 * Middleware to ensure workspace has an active subscription or valid grace period
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || user.role === 'ADMIN' || user.is_superuser) {
      return next();
    }

    const ownerId = user.owner_id || user.id;
    const subData = await subscriptionService.getCurrentSubscription(ownerId);
    const sub = subData.subscription;

    if (sub && sub.status === 'EXPIRED') {
      return res.status(403).json({
        success: false,
        message: 'Your PMS Pro subscription has expired. Please renew your plan to continue using this feature.',
        code: 'SUBSCRIPTION_EXPIRED',
        requires_upgrade: true,
      });
    }

    next();
  } catch (error) {
    console.error('Subscription verification error:', error);
    next();
  }
};

module.exports = {
  checkUnitQuota,
  requireActiveSubscription,
};
