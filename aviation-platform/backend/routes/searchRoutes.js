const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const auth = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(auth);

// Advanced search endpoints
router.get('/professionals', searchController.searchProfessionals);

// Search by specific criteria
router.get('/aircraft-type/:aircraftType', searchController.searchByAircraftType);
router.get('/certification/:certification', searchController.searchByCertification);

// Get available positions
router.get('/positions', searchController.getAvailablePositions);

// Search statistics
router.get('/stats', searchController.getSearchStats);

// Similar professionals
router.get('/similar/:userId', searchController.getSimilarProfessionals);

module.exports = router;