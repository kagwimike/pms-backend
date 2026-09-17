const Property = require('../models/Property');
const Amenity = require('../models/Amenity');
const PropertyImage = require('../models/PropertyImage');
const ApiError = require('../utils/ApiError');
const slugify = require('slugify');

const createProperty = async (propertyBody, ownerId, images, amenities_ids = [], new_amenities = []) => {
  let slug = slugify(propertyBody.name, { lower: true, strict: true });
  const property = await Property.create({ ...propertyBody, slug, owner_id: ownerId });

  // Handle existing amenities
  if (amenities_ids && amenities_ids.length > 0) {
    await property.addAmenities(amenities_ids);
  }

  // Handle dynamic new amenities creation
  if (new_amenities && new_amenities.length > 0) {
    for (let name of new_amenities) {
      if (name.trim()) {
        const [amenityObj] = await Amenity.findOrCreate({ where: { name: name.trim() } });
        await property.addAmenity(amenityObj);
      }
    }
  }

  // Handle image creation mapping
  if (images && images.length > 0) {
    const imageRecords = images.map(img => ({
      property_id: property.id,
      image: `property_images/${img.filename}`,
    }));
    await PropertyImage.bulkCreate(imageRecords);
  }

  return property;
};

const getProperties = async (user, limit, cursorWhere, order) => {
  // Adding include clauses to prefetch relationships
  const include = [{ model: Amenity, as: 'amenities' }, { model: PropertyImage, as: 'images' }];
  
  if (user.role === 'ADMIN') {
    return Property.findAll({ where: cursorWhere, include, limit, order });
  } else if (user.role === 'OWNER') {
    return Property.findAll({ where: { owner_id: user.id, ...cursorWhere }, include, limit, order });
  }
  return []; 
};

const getPropertyById = async (id) => {
  const include = [{ model: Amenity, as: 'amenities' }, { model: PropertyImage, as: 'images' }];
  const property = await Property.findOne({ where: { id }, include });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }
  return property;
};

const updateProperty = async (id, updateBody) => {
  const property = await getPropertyById(id);
  Object.assign(property, updateBody);
  if (updateBody.name) {
    property.slug = slugify(updateBody.name, { lower: true, strict: true });
  }
  await property.save();
  return property;
};

const deleteProperty = async (id) => {
  const property = await getPropertyById(id);
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
