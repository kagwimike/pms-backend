const express = require('express');
const { globalSearch } = require('../controllers/search.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Defer middleware resolution to runtime to avoid CommonJS circular dependency empty object bugs
router.use((req, res, next) => {
  if (!authMiddleware || !authMiddleware.auth) {
    return next(new Error("Auth middleware not loaded correctly"));
  }
  return authMiddleware.auth(req, res, next);
});

router.get('/', globalSearch);

module.exports = router;
