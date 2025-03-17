const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { uploadSingle } = require('../middlewares/uploadMiddleware');
const auth = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes
router.use(auth); // Apply authentication middleware to all routes below

// Profile management
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/profile/avatar', uploadSingle('avatar'), userController.updateAvatar);
router.put('/password', userController.updatePassword);
router.delete('/account', userController.deleteAccount);

// Certification management
router.post(
  '/certifications',
  uploadSingle('certificate'),
  userController.addCertification
);
router.put(
  '/certifications/:certificationId',
  uploadSingle('certificate'),
  userController.updateCertification
);
router.delete(
  '/certifications/:certificationId',
  userController.deleteCertification
);

// Search
router.get('/search', userController.searchUsers);

module.exports = router;