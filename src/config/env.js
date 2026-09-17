const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../../.env") });

module.exports = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
 

  dbHost: process.env.DB_HOST,
  dbPort: process.env.DB_PORT,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,

  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: process.env.REDIS_PORT || 6379,
  redisPassword: process.env.REDIS_PASSWORD || "",
};
