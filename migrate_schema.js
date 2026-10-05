/**
 * Additive-only schema migration.
 *
 * Brings the live MySQL schema in line with the Sequelize models WITHOUT
 * dropping or altering any existing column/data:
 *   - creates tables that are missing (CREATE TABLE IF NOT EXISTS)
 *   - adds columns that are missing (always added as NULL-able so existing rows stay valid)
 *
 * Usage:  node migrate_schema.js            (apply)
 *         node migrate_schema.js --dry-run  (report only)
 */
const fs = require('fs');
const path = require('path');
const { sequelize, connectDB } = require('./src/config/db');

const DRY_RUN = process.argv.includes('--dry-run');
const modelsDir = path.join(__dirname, 'src', 'models');

(async () => {
  try {
    await connectDB();
    const models = fs
      .readdirSync(modelsDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => require(path.join(modelsDir, f)))
      .filter((m) => m && typeof m.getTableName === 'function');

    const qi = sequelize.getQueryInterface();
    const existing = new Set((await qi.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName)));

    for (const model of models) {
      const table = model.getTableName();

      if (!existing.has(table)) {
        console.log(`${DRY_RUN ? '[dry-run] would create' : 'Creating'} table ${table}`);
        if (!DRY_RUN) await model.sync(); // CREATE TABLE IF NOT EXISTS — never alters
        continue;
      }

      const dbCols = await qi.describeTable(table);
      for (const attr of Object.values(model.rawAttributes)) {
        if (dbCols[attr.field]) continue;
        console.log(`${DRY_RUN ? '[dry-run] would add' : 'Adding'} column ${table}.${attr.field}`);
        if (!DRY_RUN) {
          await qi.addColumn(table, attr.field, {
            type: attr.type,
            allowNull: true,
            defaultValue: attr.defaultValue,
          });
        }
      }
    }
    console.log(DRY_RUN ? 'Dry run complete.' : 'Schema migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
