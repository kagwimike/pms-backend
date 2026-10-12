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
  .then(async () => {
    try {
      const { sequelize } = require('./config/db');
      const ChatSession = require('./models/ChatSession');
      const ChatParticipant = require('./models/ChatParticipant');
      const ChatMessage = require('./models/ChatMessage');
      const CommunicationDevice = require('./models/CommunicationDevice');

      // Ensure communication tables and schemas are synchronized
      await ChatSession.sync({ alter: true }).catch(() => {});
      await ChatParticipant.sync({ alter: true }).catch(() => {});
      await ChatMessage.sync({ alter: true }).catch(() => {});
      await CommunicationDevice.sync({ alter: true }).catch(() => {});

      await sequelize.query('ALTER TABLE communication_chat_sessions MODIFY tenant_id BIGINT NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE communication_chat_messages ADD COLUMN media_url VARCHAR(500) NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE communication_chat_messages ADD COLUMN reaction VARCHAR(20) NULL;').catch(() => {});
      
      // Inspection move-in/out and checklist migrations
      await sequelize.query('ALTER TABLE inspections_inspection ADD COLUMN checklist JSON NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE inspections_inspection ADD COLUMN total_deductions DECIMAL(12, 2) DEFAULT 0.00;').catch(() => {});
      await sequelize.query('ALTER TABLE inspections_inspection ADD COLUMN deposit_refunded DECIMAL(12, 2) DEFAULT 0.00;').catch(() => {});
      await sequelize.query("ALTER TABLE inspections_inspection ADD COLUMN refund_status ENUM('NONE', 'CALCULATED', 'REFUNDED', 'FORFEITED', 'DISPUTED') DEFAULT 'NONE';").catch(() => {});
      
      // Damage pricing and catalog columns
      await sequelize.query('ALTER TABLE inspections_damage ADD COLUMN item_name VARCHAR(100) NULL;').catch(() => {});
      await sequelize.query("ALTER TABLE inspections_damage ADD COLUMN `condition` ENUM('GOOD', 'FAIR', 'POOR', 'BROKEN', 'MISSING') DEFAULT 'BROKEN';").catch(() => {});
      await sequelize.query('ALTER TABLE inspections_damage ADD COLUMN quantity INT DEFAULT 1;').catch(() => {});
      await sequelize.query('ALTER TABLE inspections_damage ADD COLUMN unit_price DECIMAL(12, 2) DEFAULT 0.00;').catch(() => {});
    } catch (e) {}

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