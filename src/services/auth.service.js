const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// We should put this in env, but mimicking python exact code mapping for now
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "239105933863-uarm1uqc28mk9us460kr0tm9r3fv46po.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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

const verifyGoogleTokenAndLogin = async (token) => {
  if (!token) {
    throw new ApiError(400, 'OAuth credential token is missing.');
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const email = payload.email;
    const first_name = payload.given_name || '';
    const last_name = payload.family_name || '';

    if (!email) {
      throw new ApiError(400, 'Failed to resolve email from signature payload.');
    }

    let [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        username: email.split('@')[0],
        // Since password is required in the DB, we generate a random one for OAuth users
        password: Math.random().toString(36).slice(-8), 
        role: 'OWNER', // Mapped from 'LANDLORD' in python
        is_verified: true,
      }
    });

    return user;
  } catch (error) {
    throw new ApiError(401, 'Invalid or compromised token payload authentication validation. ' + error.message);
  }
};

module.exports = {
  loginUserWithEmailAndPassword,
  generateAuthTokens,
  verifyGoogleTokenAndLogin,
};
