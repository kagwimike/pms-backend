const express = require('express');
const documentController = require('../controllers/document.controller');
const { auth } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, upload.single('file'), documentController.createDocument)
  .get(auth, documentController.getDocuments);

router
  .route('/:documentId')
  .get(auth, documentController.getDocument)
  .delete(auth, documentController.deleteDocument);

module.exports = router;
