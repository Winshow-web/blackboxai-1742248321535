const User = require('../models/userModel');
const WorkHistory = require('../models/workHistoryModel');
const { APIError } = require('../middlewares/errorHandler');

// Advanced search for aviation professionals
exports.searchProfessionals = async (req, res, next) => {
  try {
    const {
      role,
      experience,
      skills,
      aircraftTypes,
      languages,
      certifications,
      location,
      availability,
      minFlightHours,
      page = 1,
      limit = 10,
      sortBy = 'totalFlightHours',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Basic filters
    if (role) query.role = role;
    if (availability) query.isAvailable = availability === 'true';
    if (location) query.preferredLocations = { $in: [location] };
    if (minFlightHours) query.totalFlightHours = { $gte: Number(minFlightHours) };

    // Array filters
    if (skills) query.skills = { $in: skills.split(',') };
    if (aircraftTypes) query.aircraftTypes = { $in: aircraftTypes.split(',') };
    if (languages) query['languages.language'] = { $in: languages.split(',') };

    // Certification filter
    if (certifications) {
      query['certifications.name'] = { $in: certifications.split(',') };
      query['certifications.verificationStatus'] = 'verified';
    }

    // Experience filter (in years)
    if (experience) {
      const experienceDate = new Date();
      experienceDate.setFullYear(experienceDate.getFullYear() - parseInt(experience));
      query['workHistory.startDate'] = { $lte: experienceDate };
    }

    // Execute search with pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [professionals, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Enhance results with work history details
    const enhancedProfessionals = await Promise.all(
      professionals.map(async (professional) => {
        const workHistory = await WorkHistory.find({ user: professional._id })
          .sort({ 'period.startDate': -1 })
          .limit(1)
          .lean();

        return {
          ...professional,
          recentEmployer: workHistory[0]?.employer?.name || null,
          currentPosition: workHistory[0]?.position?.title || null
        };
      })
    );

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      professionals: enhancedProfessionals
    });
  } catch (error) {
    next(error);
  }
};

// Search by specific criteria (e.g., aircraft type)
exports.searchByAircraftType = async (req, res, next) => {
  try {
    const { aircraftType } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      User.find({ aircraftTypes: aircraftType })
        .select('-password')
        .sort({ totalFlightHours: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments({ aircraftTypes: aircraftType })
    ]);

    // Get flight hours specific to this aircraft type
    const enhancedProfessionals = await Promise.all(
      professionals.map(async (professional) => {
        const workHistories = await WorkHistory.find({
          user: professional._id,
          'flightRecords.aircraftTypes.aircraft': aircraftType
        });

        const aircraftTypeHours = workHistories.reduce((total, history) => {
          const aircraftRecord = history.flightRecords.aircraftTypes
            .find(record => record.aircraft === aircraftType);
          return total + (aircraftRecord?.hours || 0);
        }, 0);

        return {
          ...professional,
          aircraftTypeHours
        };
      })
    );

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      professionals: enhancedProfessionals
    });
  } catch (error) {
    next(error);
  }
};

// Search by certification
exports.searchByCertification = async (req, res, next) => {
  try {
    const { certification } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      'certifications.name': certification
    };

    if (status) {
      query['certifications.verificationStatus'] = status;
    }

    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ 'certifications.issueDate': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Enhance results with certification details
    const enhancedProfessionals = professionals.map(professional => {
      const relevantCertification = professional.certifications
        .find(cert => cert.name === certification);

      return {
        ...professional,
        certificationDetails: relevantCertification
      };
    });

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      professionals: enhancedProfessionals
    });
  } catch (error) {
    next(error);
  }
};

// Get available positions
exports.getAvailablePositions = async (req, res, next) => {
  try {
    const positions = await WorkHistory.distinct('position.title');
    
    res.status(200).json({
      success: true,
      positions
    });
  } catch (error) {
    next(error);
  }
};

// Get statistics for search results
exports.getSearchStats = async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          avgFlightHours: { $avg: '$totalFlightHours' },
          avgExperience: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                365 * 24 * 60 * 60 * 1000 // Convert to years
              ]
            }
          }
        }
      }
    ]);

    const certificationStats = await User.aggregate([
      { $unwind: '$certifications' },
      {
        $group: {
          _id: '$certifications.name',
          count: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [
                { $eq: ['$certifications.verificationStatus', 'verified'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      roleStats: stats,
      certificationStats
    });
  } catch (error) {
    next(error);
  }
};

// Suggest similar professionals
exports.getSimilarProfessionals = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      throw new APIError('User not found', 404);
    }

    // Find professionals with similar skills and aircraft types
    const similarProfessionals = await User.find({
      _id: { $ne: userId },
      $or: [
        { skills: { $in: user.skills } },
        { aircraftTypes: { $in: user.aircraftTypes } },
        { role: user.role }
      ]
    })
    .select('-password')
    .limit(5)
    .lean();

    // Calculate similarity score
    const enhancedResults = similarProfessionals.map(professional => {
      const skillsMatch = professional.skills
        .filter(skill => user.skills.includes(skill)).length;
      const aircraftMatch = professional.aircraftTypes
        .filter(type => user.aircraftTypes.includes(type)).length;
      
      const similarityScore = 
        (skillsMatch / user.skills.length) * 0.4 +
        (aircraftMatch / user.aircraftTypes.length) * 0.4 +
        (professional.role === user.role ? 0.2 : 0);

      return {
        ...professional,
        similarityScore
      };
    });

    // Sort by similarity score
    enhancedResults.sort((a, b) => b.similarityScore - a.similarityScore);

    res.status(200).json({
      success: true,
      professionals: enhancedResults
    });
  } catch (error) {
    next(error);
  }
};