const SubscriptionPlan = require('../models/SubscriptionPlan');
const logger = require('../utils/logger');

const DEFAULT_PLANS = [
  {
    code: 'STARTER',
    name: 'Starter Landlord',
    tagline: 'Ideal for individual landlords managing their initial buildings and units',
    price_monthly_kes: 2500.00,
    price_annual_kes: 25000.00,
    max_units: 25,
    max_staff: 1,
    has_mpesa_auto_reconcile: false,
    has_kra_tax_reports: false,
    has_landlord_payout_sheets: false,
    monthly_sms_quota: 100,
    is_popular: false,
    is_active: true,
    features: [
      'Up to 25 rental units',
      '1–2 building properties',
      '1 caretaker / staff seat',
      'Manual rent invoicing & digital receipts',
      'Tenant self-service portal',
      'Maintenance work order logging',
      'Basic monthly income & expense statement',
      '100 automated SMS alerts / month',
    ],
  },
  {
    code: 'PRO',
    name: 'Professional Agency',
    tagline: 'Built for active letting agencies and property managers scaling operations',
    price_monthly_kes: 6500.00,
    price_annual_kes: 65000.00,
    max_units: 100,
    max_staff: 5,
    has_mpesa_auto_reconcile: true,
    has_kra_tax_reports: true,
    has_landlord_payout_sheets: true,
    monthly_sms_quota: 500,
    is_popular: true,
    is_active: true,
    features: [
      'Up to 100 rental units',
      'Unlimited properties & estates',
      '5 caretaker & staff accounts',
      'Automated M-Pesa C2B Paybill & Till reconciliation',
      'Landlord remittance payout sheets & management fees',
      'KRA Monthly Rental Income Tax (7.5%) export',
      'Vendor quote & maintenance dispatch tracking',
      'Document vault & digital lease agreements',
      '500 automated SMS alerts / month',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise Portfolio',
    tagline: 'For commercial portfolios, multi-branch letting firms, and real estate developers',
    price_monthly_kes: 15000.00,
    price_annual_kes: 150000.00,
    max_units: 300,
    max_staff: 999,
    has_mpesa_auto_reconcile: true,
    has_kra_tax_reports: true,
    has_landlord_payout_sheets: true,
    monthly_sms_quota: 2000,
    is_popular: false,
    is_active: true,
    features: [
      'Up to 300 rental units (scalable add-ons)',
      'Unlimited properties & portfolios',
      'Unlimited staff & caretaker seats',
      'Multiple M-Pesa Paybills & commercial bank accounts',
      'Custom SMS Sender ID (e.g. YOURAGENCY)',
      'Advanced multi-branch reporting & user RBAC',
      'Dedicated account manager & priority 24/7 SLA',
      'Custom API integrations & accounting exports',
      '2,000 automated SMS alerts / month',
    ],
  },
];

async function seedSubscriptionPlans() {
  try {
    for (const planData of DEFAULT_PLANS) {
      const existing = await SubscriptionPlan.findOne({ where: { code: planData.code } });
      if (!existing) {
        await SubscriptionPlan.create(planData);
        logger.info(`Seeded subscription plan: ${planData.name}`);
      } else {
        await existing.update(planData);
      }
    }
    logger.info('Subscription plans verified successfully.');
  } catch (error) {
    logger.error('Error seeding subscription plans:', error);
  }
}

module.exports = { seedSubscriptionPlans, DEFAULT_PLANS };
