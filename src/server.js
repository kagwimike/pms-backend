const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");
const { connectDB } = require("./config/db");
require("./jobs/registerJobs"); // Initialize jobs and queues

let server;
connectDB().then(() => {
  server = app.listen(env.port, () => {
    logger.info(`Server is running on port ${env.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});
