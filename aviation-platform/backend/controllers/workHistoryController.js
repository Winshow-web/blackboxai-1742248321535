const WorkHistory = require('../models/workHistoryModel');
const User = require('../models/userModel');
const { APIError } = require('../middlewares/errorHandler');
const { cleanupUploadedFiles } = require('../middlewares/uploadMiddleware');

// Create work history entry
exports.createWorkHistory = async (req, res, next) => {
  try {
    const workHistoryData = {
      ...req.body,
      user: req.user.id
    };

    // Handle document uploads if any
    if (req.files) {
      workHistoryData.documents = req.files.map(file => ({
        type: file.fieldname,
        title: file.originalname,
        url: file.filename
      }));
    }

    const workHistory = await WorkHistory.create(workHistoryData);

    // Update user's total flight hours if provided
    if (workHistoryData.flightRecords?.totalHours) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { totalFlightHours: workHistoryData.flightRecords.totalHours }
      });
    }

    res.status(201).json({
      success: true,
      workHistory
    });
  } catch (error) {
    // Cleanup uploaded files in case of error
    if (req.files) {
      cleanupUploadedFiles(req.files);
    }
    next(error);
  }
};

// Get all work history entries for a user
exports.getAllWorkHistory = async (req, res, next) => {
  try {
    const workHistory = await WorkHistory.find({ user: req.user.id })
      .sort({ 'period.startDate': -1 });

    res.status(200).json({
      success: true,
      count: workHistory.length,
      workHistory
    });
  } catch (error) {
    next(error);
  }
};

// Get single work history entry
exports.getWorkHistory = async (req, res, next) => {
  try {
    const workHistory = await WorkHistory.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!workHistory) {
      throw new APIError('Work history entry not found', 404);
    }

    res.status(200).json({
      success: true,
      workHistory
    });
  } catch (error) {
    next(error);
  }
};

// Update work history entry
exports.updateWorkHistory = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    // Handle document uploads if any
    if (req.files) {
      updateData.documents = req.files.map(file => ({
        type: file.fieldname,
        title: file.originalname,
        url: file.filename
      }));
    }

    // Get original work history for flight hours calculation
    const originalWorkHistory = await WorkHistory.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!originalWorkHistory) {
      if (req.files) {
        cleanupUploadedFiles(req.files);
      }
      throw new APIError('Work history entry not found', 404);
    }

    // Update work history
    const workHistory = await WorkHistory.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    // Update user's total flight hours if changed
    if (updateData.flightRecords?.totalHours) {
      const hoursDifference = updateData.flightRecords.totalHours - 
        (originalWorkHistory.flightRecords?.totalHours || 0);
      
      if (hoursDifference !== 0) {
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { totalFlightHours: hoursDifference }
        });
      }
    }

    res.status(200).json({
      success: true,
      workHistory
    });
  } catch (error) {
    if (req.files) {
      cleanupUploadedFiles(req.files);
    }
    next(error);
  }
};

// Delete work history entry
exports.deleteWorkHistory = async (req, res, next) => {
  try {
    const workHistory = await WorkHistory.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!workHistory) {
      throw new APIError('Work history entry not found', 404);
    }

    // Update user's total flight hours
    if (workHistory.flightRecords?.totalHours) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { totalFlightHours: -workHistory.flightRecords.totalHours }
      });
    }

    await workHistory.remove();

    res.status(200).json({
      success: true,
      message: 'Work history entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add flight record to work history
exports.addFlightRecord = async (req, res, next) => {
  try {
    const { aircraftType, hours, routes } = req.body;

    const workHistory = await WorkHistory.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $push: {
          'flightRecords.aircraftTypes': { aircraft: aircraftType, hours },
          'flightRecords.routes': routes
        },
        $inc: { 'flightRecords.totalHours': hours }
      },
      { new: true }
    );

    if (!workHistory) {
      throw new APIError('Work history entry not found', 404);
    }

    // Update user's total flight hours
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalFlightHours: hours }
    });

    res.status(200).json({
      success: true,
      workHistory
    });
  } catch (error) {
    next(error);
  }
};

// Add achievement to work history
exports.addAchievement = async (req, res, next) => {
  try {
    const achievementData = { ...req.body };
    
    if (req.file) {
      achievementData.documentUrl = req.file.filename;
    }

    const workHistory = await WorkHistory.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $push: { achievements: achievementData }
      },
      { new: true }
    );

    if (!workHistory) {
      if (req.file) {
        cleanupUploadedFiles(req.file);
      }
      throw new APIError('Work history entry not found', 404);
    }

    res.status(200).json({
      success: true,
      workHistory
    });
  } catch (error) {
    if (req.file) {
      cleanupUploadedFiles(req.file);
    }
    next(error);
  }
};

// Add performance rating
exports.addPerformanceRating = async (req, res, next) => {
  try {
    const workHistory = await WorkHistory.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $push: {
          'performance.ratings': {
            ...req.body,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    if (!workHistory) {
      throw new APIError('Work history entry not found', 404);
    }

    res.status(200).json({
      success: true,
      workHistory
    });
  } catch (error) {
    next(error);
  }
};

// Get work history statistics
exports.getWorkHistoryStats = async (req, res, next) => {
  try {
    const stats = await WorkHistory.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalEmployers: { $sum: 1 },
          totalFlightHours: { $sum: '$flightRecords.totalHours' },
          avgRating: { $avg: '$performance.ratings.score' },
          totalAchievements: { $sum: { $size: '$achievements' } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: stats[0] || {
        totalEmployers: 0,
        totalFlightHours: 0,
        avgRating: 0,
        totalAchievements: 0
      }
    });
  } catch (error) {
    next(error);
  }
};