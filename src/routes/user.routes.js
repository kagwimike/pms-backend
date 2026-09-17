const express = require('express');
const userController = require('../controllers/user.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/:userId')
  .get(auth, userController.getUser)
  .put(auth, userController.updateUser)
  .patch(auth, userController.updateUser)
  .delete(auth, userController.deleteUser);

router
  .route('/:userId/archive')
  .patch(auth, userController.archiveTenant);

module.exports = router;
