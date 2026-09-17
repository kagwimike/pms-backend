In this folder C:\Users\laptop\PMS Pro\PMS-System\backend-node i want to migrate this C:\Users\laptop\PMS Pro\PMS-System\Backend which is a python project to a node.js project in the first link provided, in the new node.js project i want us to have an architecture as given below src/ 
│
├── app.js
├── server.js
│
├── config/
│   ├── db.js
│   ├── redis.js
│   └── env.js
│
├── routes/
│   ├── index.js
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── property.routes.js
│   └── booking.routes.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── property.controller.js
│   └── booking.controller.js
│
├── services/
│   ├── auth.service.js
│   ├── user.service.js
│   ├── property.service.js
│   └── booking.service.js
│
├── models/
│   ├── User.js
│   ├── Property.js
│   └── Booking.js
│
├── middleware/
│   ├── auth.middleware.js
│   ├── error.middleware.js
│   └── notFound.middleware.js
│
├── validators/
│   ├── auth.validator.js
│   └── property.validator.js
│
├── jobs/
│   │
│   ├── queues/
│   │   ├── email.queue.js
│   │   ├── notification.queue.js
│   │   └── cleanup.queue.js
│   │
│   ├── workers/
│   │   ├── email.worker.js
│   │   ├── notification.worker.js
│   │   └── cleanup.worker.js
│   │
│   ├── processors/
│   │   ├── email.processor.js
│   │   ├── notification.processor.js
│   │   └── cleanup.processor.js
│   │
│   ├── schedulers/
│   │   ├── cleanup.scheduler.js
│   │   └── report.scheduler.js
│   │
│   └── registerJobs.js
│
├── utils/
│   ├── ApiError.js
│   └── logger.js
│
└── constants/
    └── jobNames.js  

first understand the python project before implementing anything 