/**
 * Idempotent schema migration for: Payments (M-Pesa / Bank readiness), Invoices,
 * Inspections, Documents, Leases and Maintenance SLA tracking.
 *
 * sequelize.sync({ alter: true }) is intentionally NOT used in this project,
 * so new columns are added here explicitly. Safe to run multiple times.
 *
 * Usage:  node scripts/migrate_v2_modules.js
 */
const { sequelize } = require('../src/config/db');

const addColumns = {
  payments_payment: {
    status: "VARCHAR(20) NOT NULL DEFAULT 'PENDING'",
    phone_number: 'VARCHAR(20) NULL',
    checkout_request_id: 'VARCHAR(100) NULL',
    merchant_request_id: 'VARCHAR(100) NULL',
    account_reference: 'VARCHAR(100) NULL',
    payer_name: 'VARCHAR(150) NULL',
    notes: 'TEXT NULL',
  },
  payments_invoice: {
    due_soon_notified: 'TINYINT(1) NOT NULL DEFAULT 0',
    overdue_notified: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  core_document: {
    expiry_date: 'DATE NULL',
    expiry_notified: 'TINYINT(1) NOT NULL DEFAULT 0',
    original_name: 'VARCHAR(255) NULL',
    mime_type: 'VARCHAR(100) NULL',
  },
  leases_lease: {
    renewal_reminder_sent: 'TINYINT(1) NOT NULL DEFAULT 0',
    expiry_notified: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  maintenance_maintenancerequest: {
    sla_warning_sent: 'TINYINT(1) NOT NULL DEFAULT 0',
    sla_breached_sent: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
};

// Column definition changes on existing columns
const modifyColumns = [
  // Unmatched M-Pesa / bank payments have no invoice yet
  'ALTER TABLE `payments_payment` MODIFY `invoice_id` BIGINT(20) NULL',
  'ALTER TABLE `payments_payment` MODIFY `is_confirmed` TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE `payments_payment` MODIFY `payment_method` VARCHAR(20) NOT NULL DEFAULT \'MPESA\'',
  // Lease notes were NOT NULL without a default (inserts without notes failed)
  'ALTER TABLE `leases_lease` MODIFY `notes` LONGTEXT NULL',
];

const indexes = [
  ['payments_payment', 'idx_payment_checkout_request', 'checkout_request_id'],
  ['payments_payment', 'idx_payment_status', 'status'],
];

(async () => {
  for (const [table, cols] of Object.entries(addColumns)) {
    const [existing] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\``);
    const names = new Set(existing.map((c) => c.Field));
    for (const [col, def] of Object.entries(cols)) {
      if (names.has(col)) {
        console.log(`= ${table}.${col} exists`);
        continue;
      }
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`+ ${table}.${col} added`);
    }
  }

  for (const sql of modifyColumns) {
    await sequelize.query(sql);
    console.log(`~ ${sql}`);
  }

  for (const [table, name, col] of indexes) {
    const [idx] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${name}'`);
    if (idx.length === 0) {
      await sequelize.query(`CREATE INDEX \`${name}\` ON \`${table}\` (\`${col}\`)`);
      console.log(`+ index ${name}`);
    }
  }

  // Backfill payment status for rows created before the status column existed
  const [result] = await sequelize.query(
    "UPDATE `payments_payment` SET `status` = 'CONFIRMED' WHERE `is_confirmed` = 1 AND `status` = 'PENDING'"
  );
  console.log(`~ backfilled confirmed payments: ${result.affectedRows ?? 0}`);

  console.log('Migration complete.');
  process.exit(0);
})().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
