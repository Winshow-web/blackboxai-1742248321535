const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const auth = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(auth);

// Payroll setup and preferences
router.post('/setup', payrollController.setupPayroll);
router.put('/preferences', payrollController.updatePaymentPreferences);

// Payroll generation and processing
router.post('/generate', payrollController.generatePayroll);
router.post('/process-payment', payrollController.processPayment);

// Payment history and statistics
router.get('/history', payrollController.getPaymentHistory);
router.get('/stats', payrollController.getPaymentStats);

module.exports = router;