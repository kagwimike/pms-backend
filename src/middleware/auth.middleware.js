const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Please authenticate');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.jwtSecret);
    
    // Check if user still exists
    const user = await User.findByPk(payload.sub);
    if (!user) {
      throw new ApiError(401, 'Please authenticate');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
};

module.exports = { auth, authorize };
