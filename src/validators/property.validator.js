const Joi = require('joi');

const createProperty = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    property_type: Joi.string().required().valid('APARTMENT', 'HOTEL', 'AIRBNB'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'MAINTENANCE'),
    address: Joi.string().required(),
    city: Joi.string().required(),
    country: Joi.string().required(),
    total_units: Joi.number().integer().min(1),
    description: Joi.string().allow('', null),
  }),
};

const getProperty = {
  params: Joi.object().keys({
    propertyId: Joi.number().integer().required(),
  }),
};

module.exports = {
  createProperty,
  getProperty,
};
