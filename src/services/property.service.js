const Property = require('../models/Property');
const Amenity = require('../models/Amenity');
const PropertyImage = require('../models/PropertyImage');
const Unit = require('../models/Unit');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const slugify = require('slugify');

// Fields an owner is allowed to set/modify on a property.
const EDITABLE_FIELDS = ['name', 'property_type', 'status', 'address', 'city', 'country', 'total_units', 'description'];

const OWNER_ATTRIBUTES = ['id', 'username', 'email', 'first_name', 'last_name', 'phone'];

// Relations returned with every property so the frontend can render it fully.
const listInclude = () => [
  { model: Amenity, as: 'amenities', through: { attributes: [] } },
  { model: PropertyImage, as: 'images' },
  { model: User, as: 'owner', attributes: OWNER_ATTRIBUTES },
];

const detailInclude = () => [...listInclude(), { model: Unit, as: 'units' }];

const pickEditable = (body = {}) => {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (out.property_type) out.property_type = String(out.property_type).toUpperCase();
  if (out.status) out.status = String(out.status).toUpperCase();
  if (out.total_units !== undefined) out.total_units = parseInt(out.total_units, 10) || 1;
  if (typeof out.description === 'string') out.description = out.description.trim();
  return out;
};

const uniqueSlug = async (name, excludeId = null) => {
  const baseSlug = slugify(name, { lower: true, strict: true }) || 'property';
  let slug = baseSlug;
  let counter = 1;
  // paranoid:false so soft-deleted rows (which still hold the unique slug) are also checked
  // eslint-disable-next-line no-await-in-loop
  while (true) {
    const clash = await Property.findOne({ where: { slug }, paranoid: false });
    if (!clash || (excludeId && String(clash.id) === String(excludeId))) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
};

const attachAmenities = async (property, amenityIds = [], newAmenities = []) => {
  if (amenityIds.length > 0) {
    await property.addAmenities(amenityIds);
  }
  for (const name of newAmenities) {
    if (typeof name === 'string' && name.trim()) {
      const [amenityObj] = await Amenity.findOrCreate({ where: { name: name.trim() } });
      await property.addAmenity(amenityObj);
    }
  }
};

const assertCanAccess = (property, user) => {
  if (!user) return;
  if (user.role === 'ADMIN') return;
  if (String(property.owner_id) !== String(user.id)) {
    throw new ApiError(403, 'You do not have access to this property');
  }
};

const getPropertyById = async (id, user = null) => {
  const property = await Property.findOne({ where: { id }, include: detailInclude() });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }
  assertCanAccess(property, user);
  return property;
};

const createProperty = async (propertyBody, ownerId, images, amenities_ids = [], new_amenities = []) => {
  const data = pickEditable(propertyBody);
  for (const field of ['name', 'address', 'city', 'country']) {
    if (!data[field] || !String(data[field]).trim()) {
      throw new ApiError(400, `Property ${field} is required`);
    }
  }

  const property = await Property.create({
    ...data,
    slug: await uniqueSlug(data.name),
    owner_id: ownerId,
    total_units: data.total_units || 1,
    property_type: data.property_type || 'APARTMENT',
    status: data.status || 'ACTIVE',
  });

  await attachAmenities(property, amenities_ids, new_amenities);

  if (images && images.length > 0) {
    await PropertyImage.bulkCreate(
      images.map((img) => ({ property_id: property.id, image: `property_images/${img.filename}` })),
    );
  }

  // Re-fetch so the response contains amenities, images, owner and units.
  return getPropertyById(property.id);
};

const getProperties = async (user, limit, cursorWhere, order) => {
  const include = listInclude();
  if (user.role === 'ADMIN') {
    return Property.findAll({ where: cursorWhere, include, limit, order });
  }
  if (user.role === 'OWNER') {
    return Property.findAll({ where: { owner_id: user.id, ...cursorWhere }, include, limit, order });
  }
  return [];
};

const updateProperty = async (id, updateBody, user, amenityIds = null, newAmenities = []) => {
  const property = await getPropertyById(id, user);
  const data = pickEditable(updateBody);
  if (data.name && data.name !== property.name) {
    data.slug = await uniqueSlug(data.name, property.id);
  }
  await property.update(data);

  // When the client sends an amenity list, treat it as the full desired set.
  if (amenityIds !== null) {
    await property.setAmenities(amenityIds);
    await attachAmenities(property, [], newAmenities);
  }
  return getPropertyById(id);
};

const deleteProperty = async (id, user) => {
  const property = await getPropertyById(id, user);
  // paranoid: true will automatically soft-delete
  await property.destroy();
  return property;
};

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
};
