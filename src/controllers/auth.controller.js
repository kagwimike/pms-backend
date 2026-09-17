const authService = require('../services/auth.service');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const register = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return errorResponse(res, 'A user with that email already exists', 400);
      }
    }

    if (username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        return errorResponse(res, 'A user with that username already exists', 400);
      }
    }

    const user = await User.create(req.body);
    const tokens = authService.generateAuthTokens(user);
    return successResponse(res, {
      access: tokens.access,
      refresh: tokens.refresh,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    }, 'User registered successfully', 201);
  } catch (error) {
    console.error('Error in register:', error);
    return errorResponse(res, 'Validation error', 400, error);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginUserWithEmailAndPassword(email, password);
    const tokens = authService.generateAuthTokens(user);
    
    return successResponse(res, {
      access: tokens.access,
      refresh: tokens.refresh,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    }, 'User logged in successfully');
  } catch (error) {
    console.error('Error in login:', error);
    return errorResponse(res, 'Login failed', 400, error);
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await authService.verifyGoogleTokenAndLogin(token);
    const tokens = authService.generateAuthTokens(user);

    return successResponse(res, {
      access: tokens.access,
      refresh: tokens.refresh,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    }, 'User logged in successfully');
  } catch (error) {
    console.error('Error in googleSignIn:', error);
    return errorResponse(res, 'Google Sign In failed', 400, error);
  }
};

module.exports = {
  register,
  login,
  googleSignIn,
};
