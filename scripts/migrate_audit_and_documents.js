/**
 * Idempotent schema migration for Audit Logs and Documents hardening:
 * - core_auditlog: adds module, outcome, severity, summary, actor_role, property_id, request_id, makes entity_id nullable
 * - core_document: adds file_size, checksum, version, parent_document_id, status, is_finalized, is_archived, access_scope, property_id, description
 *
 * Usage: node scripts/migrate_audit_and_documents.js
 */
const { sequelize } = require('../src/config/db');

const addColumns = {
  core_auditlog: {
    module: "VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'",
    outcome: "ENUM('SUCCESS', 'FAILURE', 'DENIED') NOT NULL DEFAULT 'SUCCESS'",
    severity: "ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO'",
    summary: 'VARCHAR(255) NULL',
    actor_role: 'VARCHAR(50) NULL',
    property_id: 'BIGINT NULL',
    request_id: 'VARCHAR(100) NULL',
  },
  core_document: {
    file_size: 'BIGINT NULL DEFAULT 0',
    checksum: 'VARCHAR(64) NULL',
    version: 'INT NOT NULL DEFAULT 1',
    parent_document_id: 'BIGINT NULL',
    status: "ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'FINALIZED', 'ARCHIVED') NOT NULL DEFAULT 'APPROVED'",
    is_finalized: 'TINYINT(1) NOT NULL DEFAULT 0',
    is_archived: 'TINYINT(1) NOT NULL DEFAULT 0',
    access_scope: "ENUM('PRIVATE', 'ORGANIZATION', 'TENANT_SHARED', 'VENDOR_SHARED', 'PUBLIC') NOT NULL DEFAULT 'ORGANIZATION'",
    property_id: 'BIGINT NULL',
    description: 'TEXT NULL',
  },
};

const modifyColumns = [
  // Allow entity_id to be nullable in core_auditlog (e.g. system/auth-wide events without a resource ID)
  'ALTER TABLE `core_auditlog` MODIFY `entity_id` BIGINT NULL',
];

const indexes = [
  ['core_auditlog', 'idx_audit_module', 'module'],
  ['core_auditlog', 'idx_audit_outcome', 'outcome'],
  ['core_auditlog', 'idx_audit_severity', 'severity'],
  ['core_auditlog', 'idx_audit_entity', 'entity_type'],
  ['core_document', 'idx_doc_parent_id', 'parent_document_id'],
  ['core_document', 'idx_doc_property_id', 'property_id'],
  ['core_document', 'idx_doc_status', 'status'],
];

async function runMigration() {
  console.log('Starting Audit Logs and Documents migration...');

  for (const [table, cols] of Object.entries(addColumns)) {
    try {
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
    } catch (err) {
      console.warn(`Could not check/alter table ${table}:`, err.message);
    }
  }

  for (const sql of modifyColumns) {
    try {
      await sequelize.query(sql);
      console.log(`~ ${sql}`);
    } catch (err) {
      console.warn(`Modify column skipped/error:`, err.message);
    }
  }

  for (const [table, name, col] of indexes) {
    try {
      const [idx] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${name}'`);
      if (idx.length === 0) {
        await sequelize.query(`CREATE INDEX \`${name}\` ON \`${table}\` (\`${col}\`)`);
        console.log(`+ index ${name} on ${table}`);
      } else {
        console.log(`= index ${name} exists on ${table}`);
      }
    } catch (err) {
      console.warn(`Index creation skipped:`, err.message);
    }
  }

  console.log('Audit Logs and Documents migration finished successfully.');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;
