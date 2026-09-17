# Property Management System (PMS) - Backend (Node.js)

This repository contains the backend service for the Property Management System. It is built using Node.js and Express.js, providing RESTful APIs for managing properties, units, tenants, leases, maintenance requests, and more. 

## Technology Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MySQL
* **ORM:** Sequelize
* **Caching & Message Broker:** Redis
* **Background Jobs:** BullMQ
* **Authentication:** JSON Web Tokens (JWT) & bcryptjs
* **Validation:** Joi
* **Logging:** Winston & Morgan
* **File Uploads:** Multer

## Architecture & Design Pattern

The application follows a standard **Model-View-Controller (MVC) / Service-Oriented Architecture** pattern, effectively separating concerns to ensure maintainability, scalability, and testability. 

### Module Breakdown (`src/`)

* **`server.js`**: The main entry point. It initializes the database connection, registers background jobs, and starts the Express server. It also handles unexpected exceptions and graceful shutdowns.
* **`app.js`**: Configures the Express application. It registers middlewares (CORS, Helmet, Morgan), sets up the main `/api` router, and applies the global error and "not found" handlers.
* **`config/`**: Contains environment configurations (`env.js`), the Sequelize database connection setup (`db.js`), and Redis connection instances (`redis.js`).
* **`constants/`**: Holds application-wide constants, such as queue/job names (`jobNames.js`), preventing hardcoded strings across the app.
* **`controllers/`**: Handles incoming HTTP requests, extracts parameters/body data, delegates business logic to the `services` layer, and returns formatted responses to the client.
* **`services/`**: The core business logic layer. Controllers call these services to interact with the database (via Models) and perform operations (e.g., creating a property, booking logic).
* **`models/`**: Sequelize ORM definitions for database tables (e.g., `Property.js`, `User.js`, `Unit.js`, `Lease.js`). It also defines relationships (associations) between different entities. Soft-deletes (`paranoid: true`) and timestamps are widely used.
* **`routes/`**: Express routers that map API endpoints to their respective controller functions. The `index.js` file aggregates all module routes (e.g., `property.routes.js`, `auth.routes.js`) under a single router.
* **`middleware/`**: Custom Express middlewares for handling Cross-Cutting Concerns:
  * Authentication (`auth.middleware.js`)
  * Global Error Handling (`error.middleware.js`)
  * File Upload handling (`upload.middleware.js`)
* **`validators/`**: Joi schemas used to validate incoming request payloads before they reach the controllers.
* **`jobs/`**: Background job processing system utilizing BullMQ and Redis.
  * **`queues/`**: Define BullMQ queues (e.g., `email.queue.js`).
  * **`workers/`**: Define processors that consume jobs from the queues and execute background tasks asynchronously (e.g., sending emails).
* **`utils/`**: Helper functions and utility classes, including custom `ApiError` class, response formatting (`formatResponse.js`), custom pagination logic (`pagination.js`), and Winston logger configurations.

## Core Features & Workflow

1. **Routing & Validation**: Incoming requests hit the `routes` where they first pass through `validators` (Joi schemas) and `middleware` (e.g., JWT authentication).
2. **Controllers**: Validated requests are handled by `controllers`. The controller parses the request (like extracting cursor metadata for pagination) and calls the relevant `service`.
3. **Services & Models**: The `service` layer performs the business logic. For example, `propertyService.createProperty` handles creating a property, associating it with a user, linking amenities, and managing image uploads. The interaction with the MySQL database is abstracted via Sequelize `models`.
4. **Standardized Responses**: All successful responses are formatted using `utils/formatResponse.js` to ensure a consistent API contract.
5. **Background Processing**: Heavy tasks like sending emails are pushed to BullMQ queues (`jobs/queues`) and processed asynchronously by workers (`jobs/workers`), keeping the API endpoints fast and responsive.
6. **Error Handling**: Synchronous and asynchronous errors are caught globally and converted into `ApiError` instances by the `error.middleware.js`, guaranteeing that the client receives structured and secure error responses.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in a `.env` file (refer to `src/config/env.js` for required variables).
3. Start the development server:
   ```bash
   npm run dev
   ```
