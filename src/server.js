const { execSync } = require("child_process");
const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");
const { connectDB } = require("./config/db");
const { initializeSocket } = require("./services/communication/socket");
require("./jobs/registerJobs"); // Initialize jobs and queues

let server;

const freePortOnWindows = (port) => {
  if (process.platform === "win32") {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const lines = output.split("\n").filter((line) => line.includes("LISTENING"));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && pid !== process.pid.toString()) {
          execSync(`taskkill /F /PID ${pid}`);
          logger.info(`Cleared lingering process (PID ${pid}) on port ${port}`);
        }
      }
    } catch (e) {
      // Ignore errors when no process is listening
    }
  }
};

connectDB()
  .then(() => {
    freePortOnWindows(env.port);
    const http = require('http');
    const httpServer = http.createServer(app);
    
    // Initialize Socket.io
    initializeSocket(httpServer);

    server = httpServer.listen(env.port, () => {
      logger.info(`Server is running on port ${env.port}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${env.port} is already in use.`);
      } else {
        logger.error("Server error:", error);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    logger.error("Failed to connect to database:", error);
    process.exit(1);
  });

const exitHandler = (code = 1) => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(code);
    });
  } else {
    process.exit(code);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler(1);
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

// Graceful shutdown for nodemon restarts
process.once("SIGUSR2", () => {
  if (server) {
    server.close(() => {
      process.kill(process.pid, "SIGUSR2");
    });
  } else {
    process.kill(process.pid, "SIGUSR2");
  }
});

process.on("SIGINT", () => {
  logger.info("SIGINT received");
  exitHandler(0);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  exitHandler(0);
});