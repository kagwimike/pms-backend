// src/middleware/notFound.middleware.js
const { errorResponse } = require("../utils/formatResponse");

module.exports = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  // Send a consistent error payload (mirrors other error responses)
  return errorResponse(res, message, 404, {
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
};
