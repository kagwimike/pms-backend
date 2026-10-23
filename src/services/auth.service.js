const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const client = new OAuth2Client(env.googleClientId, env.googleClientSecret);

const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(401, 'No active account found with the given credentials');
  }
  return user;
};

const generateAuthTokens = (user) => {
  // Access token
  const access = jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  // Refresh token (typically longer lived, standard in SimpleJWT)
  const refresh = jwt.sign({ sub: user.id, type: 'refresh' }, env.jwtSecret, {
    expiresIn: '7d',
  });

  return {
    access,
    refresh
  };
};

const verifyGoogleTokenAndLogin = async (token, requestedRole = null) => {
  if (!token) {
    throw new ApiError(400, 'OAuth credential token is missing.');
  }

  try {
    let email, first_name = '', last_name = '', profile_picture = null;

    // In development mode, allow simulated/mock google tokens for local testing
    if (env.env === 'development' && (token.startsWith('dev_') || token.startsWith('mock_'))) {
      email = token.includes('@') ? token.replace(/^(dev_|mock_)/, '') : 'demo.google@pmspro.co.ke';
      first_name = 'Google';
      last_name = 'User';
      profile_picture = null;
    } else {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: env.googleClientId,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      first_name = payload.given_name || '';
      last_name = payload.family_name || '';
      profile_picture = payload.picture || null;
    }

    if (!email) {
      throw new ApiError(400, 'Failed to resolve email from signature payload.');
    }

    // Determine target role (defaulting to OWNER if none specified or on login)
    const validRoles = ['ADMIN', 'OWNER', 'TENANT', 'CARETAKER', 'AGENT', 'VENDOR'];
    let roleToAssign = 'OWNER';
    if (requestedRole) {
      const normalized = requestedRole.toUpperCase().trim();
      if (normalized === 'LANDLORD') {
        roleToAssign = 'OWNER';
      } else if (validRoles.includes(normalized)) {
        roleToAssign = normalized;
      }
    }

    let user = await User.findOne({ where: { email } });
    if (!user) {
      let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      if (!baseUsername || baseUsername.length < 3) baseUsername = 'user_' + Math.random().toString(36).substring(2, 7);
      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ where: { username } })) {
        username = `${baseUsername}${counter++}`;
      }
      user = await User.create({
        email,
        username,
        first_name,
        last_name,
        profile_picture,
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
        role: roleToAssign,
        is_verified: true,
      });
    } else {
      if (!user.first_name && first_name) user.first_name = first_name;
      if (!user.last_name && last_name) user.last_name = last_name;
      if (!user.profile_picture && profile_picture) user.profile_picture = profile_picture;
      if (!user.is_verified) user.is_verified = true;
      await user.save();
    }

    return user;
  } catch (error) {
    throw new ApiError(401, 'Invalid or compromised token payload authentication validation. ' + error.message);
  }
};

const BlacklistedToken = require('../models/BlacklistedToken');

const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return;
    
    // Set expiration based on decoded token or default to 7 days (refresh max)
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await BlacklistedToken.findOrCreate({
      where: { token },
      defaults: { expires_at: expiresAt }
    });
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

module.exports = {
  loginUserWithEmailAndPassword,
  generateAuthTokens,
  verifyGoogleTokenAndLogin,
  blacklistToken,
};
