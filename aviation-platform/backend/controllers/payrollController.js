const User = require('../models/userModel');
const WorkHistory = require('../models/workHistoryModel');
const { APIError } = require('../middlewares/errorHandler');
const config = require('../config/config');

// PayrollRecord Schema (can be moved to models if complexity grows)
class PayrollRecord {
  constructor(data) {
    this.userId = data.userId;
    this.period = {
      startDate: data.startDate,
      endDate: data.endDate
    };
    this.earnings = {
      base: data.baseAmount || 0,
      overtime: data.overtimeAmount || 0,
      allowances: data.allowances || 0,
      bonuses: data.bonuses || 0
    };
    this.deductions = {
      tax: data.taxAmount || 0,
      insurance: data.insuranceAmount || 0,
      other: data.otherDeductions || 0
    };
    this.currency = data.currency || 'USD';
    this.status = data.status || 'pending';
    this.paymentMethod = data.paymentMethod;
    this.paymentDetails = data.paymentDetails;
}
}

// Setup payroll information
exports.setupPayroll = async (req, res, next) => {
  try {
    const {
      paymentMethod,
      bankDetails,
      taxInformation,
      currency
    } = req.body;

    // Validate currency
    if (!config.supportedCurrencies.includes(currency)) {
      throw new APIError(`Unsupported currency. Supported currencies: ${config.supportedCurrencies.join(', ')}`, 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'payroll.paymentMethod': paymentMethod,
          'payroll.bankDetails': bankDetails,
          'payroll.taxInformation': taxInformation,
          'payroll.preferredCurrency': currency
        }
      },
      { new: true }
    );

    if (!user) {
      throw new APIError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      payroll: user.payroll
    });
  } catch (error) {
    next(error);
  }
};

// Generate payroll for a period
exports.generatePayroll = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      baseAmount,
      overtimeAmount,
      allowances,
      bonuses,
      currency
    } = req.body;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      throw new APIError('End date must be after start date', 400);
    }

    // Get work history for the period
    const workHistory = await WorkHistory.find({
      user: req.user.id,
      'period.startDate': { $lte: new Date(endDate) },
      'period.endDate': { $gte: new Date(startDate) }
    });

    // Calculate flight hours for the period
    const flightHours = workHistory.reduce((total, record) => {
      return total + (record.flightRecords?.totalHours || 0);
    }, 0);

    // Create payroll record
    const payrollRecord = new PayrollRecord({
      userId: req.user.id,
      startDate,
      endDate,
      baseAmount,
      overtimeAmount,
      allowances,
      bonuses,
      currency,
      flightHours
    });

    // Calculate tax and deductions (simplified example)
    payrollRecord.deductions.tax = (baseAmount + overtimeAmount) * 0.2; // 20% tax
    payrollRecord.deductions.insurance = (baseAmount + overtimeAmount) * 0.05; // 5% insurance

    // Calculate net amount
    const grossAmount = baseAmount + overtimeAmount + allowances + bonuses;
    const totalDeductions = 
      payrollRecord.deductions.tax + 
      payrollRecord.deductions.insurance + 
      payrollRecord.deductions.other;
    
    payrollRecord.netAmount = grossAmount - totalDeductions;

    res.status(200).json({
      success: true,
      payroll: payrollRecord
    });
  } catch (error) {
    next(error);
  }
};

// Process payment
exports.processPayment = async (req, res, next) => {
  try {
    const { payrollId, paymentMethod } = req.body;

    // Simulate payment processing
    const processingTime = Math.random() * 2000; // Random processing time
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate payment success/failure
    const success = Math.random() > 0.1; // 90% success rate

    if (!success) {
      throw new APIError('Payment processing failed', 400);
    }

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      processedAt: new Date(),
      paymentMethod
    });
  } catch (error) {
    next(error);
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    // Simulate fetching payment history from database
    const mockPayments = Array.from({ length: 20 }, (_, index) => ({
      id: `PMT-${Date.now()}-${index}`,
      amount: Math.random() * 10000,
      currency: 'USD',
      status: Math.random() > 0.1 ? 'completed' : 'failed',
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      type: Math.random() > 0.5 ? 'salary' : 'bonus'
    }));

    // Filter by date if provided
    let filteredPayments = mockPayments;
    if (startDate && endDate) {
      filteredPayments = mockPayments.filter(payment => 
        payment.date >= new Date(startDate) && 
        payment.date <= new Date(endDate)
      );
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedPayments = filteredPayments
      .slice(skip, skip + parseInt(limit))
      .sort((a, b) => b.date - a.date);

    res.status(200).json({
      success: true,
      count: filteredPayments.length,
      pages: Math.ceil(filteredPayments.length / limit),
      currentPage: page,
      payments: paginatedPayments
    });
  } catch (error) {
    next(error);
  }
};

// Get payment statistics
exports.getPaymentStats = async (req, res, next) => {
  try {
    const { year, month } = req.query;

    // Simulate calculating payment statistics
    const stats = {
      totalPayments: Math.floor(Math.random() * 50000),
      averagePayment: Math.floor(Math.random() * 5000),
      totalBonuses: Math.floor(Math.random() * 10000),
      totalDeductions: Math.floor(Math.random() * 8000),
      paymentsByType: {
        salary: Math.floor(Math.random() * 40000),
        bonus: Math.floor(Math.random() * 8000),
        allowance: Math.floor(Math.random() * 2000)
      },
      paymentsByStatus: {
        completed: Math.floor(Math.random() * 45000),
        pending: Math.floor(Math.random() * 3000),
        failed: Math.floor(Math.random() * 2000)
      }
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
};

// Update payment preferences
exports.updatePaymentPreferences = async (req, res, next) => {
  try {
    const {
      preferredCurrency,
      paymentSchedule,
      notificationPreferences
    } = req.body;

    // Validate currency
    if (preferredCurrency && !config.supportedCurrencies.includes(preferredCurrency)) {
      throw new APIError(`Unsupported currency. Supported currencies: ${config.supportedCurrencies.join(', ')}`, 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'payroll.preferredCurrency': preferredCurrency,
          'payroll.paymentSchedule': paymentSchedule,
          'payroll.notificationPreferences': notificationPreferences
        }
      },
      { new: true }
    );

    if (!user) {
      throw new APIError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      preferences: {
        preferredCurrency: user.payroll.preferredCurrency,
        paymentSchedule: user.payroll.paymentSchedule,
        notificationPreferences: user.payroll.notificationPreferences
      }
    });
  } catch (error) {
    next(error);
  }
};