const subscriptionService = require('../services/subscription.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const getPlans = async (req, res) => {
  try {
    const plans = await subscriptionService.getPlans();
    return successResponse(res, plans, 'Subscription plans retrieved successfully');
  } catch (error) {
    console.error('Error in getPlans:', error);
    return errorResponse(res, error.message || 'Failed to retrieve plans', error.statusCode || 500);
  }
};

const getCurrentSubscription = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const data = await subscriptionService.getCurrentSubscription(ownerId);
    return successResponse(res, data, 'Current subscription retrieved successfully');
  } catch (error) {
    console.error('Error in getCurrentSubscription:', error);
    return errorResponse(res, error.message || 'Failed to retrieve current subscription', error.statusCode || 500);
  }
};

const initiateMpesa = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { planCode, billingCycle, phoneNumber } = req.body;

    if (!planCode) {
      return errorResponse(res, 'planCode is required', 400);
    }
    if (!phoneNumber) {
      return errorResponse(res, 'phoneNumber is required', 400);
    }

    const result = await subscriptionService.initiateMpesaSubscription(ownerId, {
      planCode,
      billingCycle: billingCycle || 'MONTHLY',
      phoneNumber,
    });

    return successResponse(res, result, 'M-Pesa payment initiated successfully', 200);
  } catch (error) {
    console.error('Error in initiateMpesa:', error);
    return errorResponse(res, error.message || 'Failed to initiate M-Pesa payment', error.statusCode || 500);
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { invoiceId, mpesaReceiptNumber } = req.body;
    if (!invoiceId) {
      return errorResponse(res, 'invoiceId is required', 400);
    }

    const result = await subscriptionService.confirmSubscriptionPayment(invoiceId, mpesaReceiptNumber);
    return successResponse(res, result, 'Subscription payment confirmed successfully');
  } catch (error) {
    console.error('Error in confirmPayment:', error);
    return errorResponse(res, error.message || 'Failed to confirm payment', error.statusCode || 500);
  }
};

const getInvoices = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const invoices = await subscriptionService.getInvoices(ownerId);
    return successResponse(res, invoices, 'Subscription invoices retrieved successfully');
  } catch (error) {
    console.error('Error in getInvoices:', error);
    return errorResponse(res, error.message || 'Failed to retrieve invoices', error.statusCode || 500);
  }
};

const triggerExpirationCheck = async (req, res) => {
  try {
    const result = await subscriptionService.checkAndNotifyExpiringSubscriptions();
    return successResponse(res, result, 'Subscription expiration check completed successfully');
  } catch (error) {
    console.error('Error in triggerExpirationCheck:', error);
    return errorResponse(res, error.message || 'Failed to trigger expiration check', error.statusCode || 500);
  }
};

module.exports = {
  getPlans,
  getCurrentSubscription,
  initiateMpesa,
  confirmPayment,
  getInvoices,
  triggerExpirationCheck,
};
