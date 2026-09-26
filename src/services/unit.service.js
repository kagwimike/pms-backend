const Unit = require('../models/Unit');
const UnitType = require('../models/UnitType');
const Lease = require('../models/Lease');
const ApiError = require('../utils/ApiError');

const Property = require('../models/Property');

// ==================== UNIT SERVICES ====================

const getUnits = async (propertyId, limit, cursorWhere, order) => {
  const whereClause = { ...cursorWhere };
  if (propertyId) {
    whereClause.property_id = propertyId;
  }
  return Unit.findAll({
    where: whereClause,
    limit,
    order,
    include: [
      { model: Property, as: 'property', attributes: ['id', 'name', 'city'] },
      { model: UnitType, as: 'unit_type', attributes: ['id', 'name', 'code', 'base_rent'] },
    ],
  });
};

const getUnitById = async (id) => {
  const unit = await Unit.findByPk(id, {
    include: [
      { model: Property, as: 'property', attributes: ['id', 'name', 'city'] },
      { model: UnitType, as: 'unit_type', attributes: ['id', 'name', 'code', 'base_rent'] },
    ],
  });
  if (!unit) throw new ApiError(404, 'Unit not found');
  return unit;
};

const createUnit = async (unitBody) => {
  return Unit.create(unitBody);
};

const updateUnit = async (id, updateBody) => {
  const unit = await Unit.findByPk(id);
  if (!unit) throw new ApiError(404, 'Unit not found');

  Object.assign(unit, updateBody);
  await unit.save();
  return unit;
};

const deleteUnit = async (id) => {
  const unit = await Unit.findByPk(id);
  if (!unit) throw new ApiError(404, 'Unit not found');

  const activeLeases = await Lease.count({
    where: { unit_id: id, status: 'ACTIVE' }
  });

  if (activeLeases > 0) {
    throw new ApiError(400, 'Cannot delete unit while an active lease exists');
  }

  await unit.destroy();
  return unit;
};

// ==================== UNIT TYPE SERVICES ====================

const getUnitTypes = async (limit, cursorWhere, order) => {
  return UnitType.findAll({
    where: cursorWhere,
    limit,
    order
  });
};

const getUnitTypeById = async (id) => {
  const unitType = await UnitType.findByPk(id);
  if (!unitType) throw new ApiError(404, 'Unit type not found');
  return unitType;
};

const createUnitType = async (unitTypeBody) => {
  return UnitType.create(unitTypeBody);
};

const updateUnitType = async (id, updateBody) => {
  const unitType = await UnitType.findByPk(id);
  if (!unitType) throw new ApiError(404, 'Unit type not found');

  Object.assign(unitType, updateBody);
  await unitType.save();
  return unitType;
};

const deleteUnitType = async (id) => {
  const unitType = await UnitType.findByPk(id);
  if (!unitType) throw new ApiError(404, 'Unit type not found');

  const attachedUnitsCount = await Unit.count({
    where: { unit_type_id: id }
  });

  if (attachedUnitsCount > 0) {
    throw new ApiError(400, 'Cannot delete unit type that is currently assigned to active units');
  }

  await unitType.destroy();
  return unitType;
};

module.exports = {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitTypes,
  getUnitTypeById,
  createUnitType,
  updateUnitType,
  deleteUnitType,
};