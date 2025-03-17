const express = require('express');
const router = express.Router();
const workHistoryController = require('../controllers/workHistoryController');
const { uploadMultiple } = require('../middlewares/uploadMiddleware');
const auth = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(auth);

// Work history management
router.post(
  '/',
  uploadMultiple('documents', 5), // Allow up to 5 documents
  workHistoryController.createWorkHistory
);

router.get('/', workHistoryController.getAllWorkHistory);
router.get('/stats', workHistoryController.getWorkHistoryStats);
router.get('/:id', workHistoryController.getWorkHistory);

router.put(
  '/:id',
  uploadMultiple('documents', 5),
  workHistoryController.updateWorkHistory
);

router.delete('/:id', workHistoryController.deleteWorkHistory);

// Flight records
router.post(
  '/:id/flight-records',
  workHistoryController.addFlightRecord
);

// Achievements
router.post(
  '/:id/achievements',
  uploadMultiple('achievement-documents', 3),
  workHistoryController.addAchievement
);

// Performance ratings
router.post(
  '/:id/performance',
  workHistoryController.addPerformanceRating
);

module.exports = router;