const express = require('express');
const documentController = require('../controllers/document.controller');
const { auth } = require('../middleware/auth.middleware');
const { documentUpload } = require('../middleware/documentUpload.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, documentUpload.single('file'), documentController.createDocument)
  .get(auth, documentController.getDocuments);

router
  .route('/:documentId')
  .get(auth, documentController.getDocument)
  .patch(auth, documentController.updateDocument)
  .put(auth, documentController.updateDocument)
  .delete(auth, documentController.deleteDocument);

router
  .route('/:documentId/download')
  .get(auth, documentController.downloadDocument);

router
  .route('/:documentId/preview')
  .get(auth, (req, res, next) => {
    req.query.preview = 'true';
    next();
  }, documentController.downloadDocument);

router
  .route('/:documentId/versions')
  .post(auth, documentUpload.single('file'), documentController.createDocumentVersion);

module.exports = router;
