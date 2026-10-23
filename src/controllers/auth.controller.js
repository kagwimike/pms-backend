const authService = require('../services/auth.service');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const NotificationService = require('../services/notification.service');
const AuditService = require('../services/audit.service');

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
    
    if (user.role === 'TENANT') {
      await NotificationService.notifyTenantCreated(user.id, null);
    }

    await AuditService.logAuth({
      req,
      action: 'USER_REGISTER',
      user,
      summary: `New user registration for ${user.username} (${user.role})`,
      details: { email: user.email, role: user.role },
    });

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
  const { email, password } = req.body;
  try {
    const user = await authService.loginUserWithEmailAndPassword(email, password);
    const tokens = authService.generateAuthTokens(user);
    
    await AuditService.logAuth({
      req,
      action: 'LOGIN_SUCCESS',
      user,
      summary: `Successful login for user ${user.username}`,
      details: { email: user.email, role: user.role },
    });

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
    await AuditService.logEvent({
      req,
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      entity_type: 'USER',
      summary: `Failed login attempt for email: ${email || 'unspecified'}`,
      outcome: 'FAILURE',
      severity: 'WARNING',
      details: { email, reason: error.message },
    });
    return errorResponse(res, 'Login failed', 400, error);
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { token, role } = req.body;
    const user = await authService.verifyGoogleTokenAndLogin(token, role);
    const tokens = authService.generateAuthTokens(user);

    await AuditService.logAuth({
      req,
      action: 'GOOGLE_SIGNIN_SUCCESS',
      user,
      summary: `Successful Google Sign-In for user ${user.username}`,
      details: { email: user.email, role: user.role },
    });

    return successResponse(res, {
      access: tokens.access,
      refresh: tokens.refresh,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_picture: user.profile_picture,
      }
    }, 'User logged in successfully');
  } catch (error) {
    console.error('Error in googleSignIn:', error);
    return errorResponse(res, error.message || 'Google Sign In failed', 400, error);
  }
};

const logout = async (req, res) => {
  try {
    const { refresh } = req.body;
    
    // Check auth header for access token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const access = authHeader.split(' ')[1];
      await authService.blacklistToken(access);
    }

    if (refresh) {
      await authService.blacklistToken(refresh);
    }
    
    if (req.user) {
      await AuditService.logAuth({
        req,
        action: 'LOGOUT',
        user: req.user,
        summary: `User ${req.user.username} logged out`,
      });
    }

    return successResponse(res, null, 'User logged out successfully');
  } catch (error) {
    console.error('Error in logout:', error);
    return errorResponse(res, 'Logout failed', 400, error);
  }
};

module.exports = {
  register,
  login,
  googleSignIn,
  logout,
};
