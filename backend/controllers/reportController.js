const mongoose = require('mongoose');
const Report = require('../models/Report');
const User = require('../models/Users');
const ResolvedReport = require('../models/ResolvedReport'); // 1. Add this import
const { cloudinary, upload } = require('../config/cloudinary');
const { sendEmailBrevo } = require('../config/emailConfig'); 
const reputationController = require('./reputationController');

const Bytez = require('bytez.js');
const bytezClient = new Bytez(process.env.BYTEZ_API_KEY);

const resolveMongoIdString = (value) => {
  if (!value && value !== 0) return undefined;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[object Object]') return undefined;

    const objectIdMatch = trimmed.match(/^ObjectId\((?:"|')?([0-9a-fA-F]{24})(?:"|')?\)$/);
    if (objectIdMatch) return objectIdMatch[1];

    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return resolveMongoIdString(parsed);
      } catch (err) {
        // ignore JSON parse error and fall through
      }
    }

    return trimmed;
  }

  if (typeof value === 'object' && value !== null) {
    if (typeof value.$oid === 'string') {
      return value.$oid;
    }
    if (typeof value._id === 'string' || value._id instanceof mongoose.Types.ObjectId) {
      return resolveMongoIdString(value._id);
    }
    if (typeof value.id === 'string' || value.id instanceof mongoose.Types.ObjectId) {
      return resolveMongoIdString(value.id);
    }
    if (typeof value.toString === 'function') {
      const asString = value.toString();
      if (asString && asString !== '[object Object]') {
        return resolveMongoIdString(asString);
      }
    }
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return undefined;
};

const normalizeComments = (comments = []) => {
  return comments.map((comment) => {
    const commentObj = comment?.toObject ? comment.toObject() : { ...comment };
    const normalizedId = resolveMongoIdString(commentObj._id || commentObj.id);
    const normalizedUserId = resolveMongoIdString(commentObj.userId);
    return {
      ...commentObj,
      _id: normalizedId || commentObj._id,
      id: normalizedId || commentObj.id,
      userId: normalizedUserId || commentObj.userId,
    };
  });
};

const findCommentById = (comments = [], rawCommentId) => {
  const normalizedCommentId = resolveMongoIdString(rawCommentId);
  if (!normalizedCommentId) return null;

  if (mongoose.Types.ObjectId.isValid(normalizedCommentId)) {
    const byObjectId = comments.id(normalizedCommentId);
    if (byObjectId) {
      return byObjectId;
    }
  }

  return (
    comments.find((comment) => {
      const candidates = [comment?._id, comment?.id];
      return candidates.some((candidate) => resolveMongoIdString(candidate) === normalizedCommentId);
    }) || null
  );
};

// Helper function to format reports with string IDs
const formatReportsWithStringIds = (reports) => {
  return reports.map(report => {
    const reportObj = report.toObject ? report.toObject() : report;
    return {
      ...reportObj,
      votedBy: (reportObj.votedBy || []).map(id => id.toString()),
      user: reportObj.user ? {
        ...reportObj.user,
        _id: reportObj.user._id ? reportObj.user._id.toString() : undefined
      } : null
    };
  });
};

// ✅ Update multer configuration to handle multiple files
const uploadMultiple = upload.array('images', 5); // Max 5 images

// Create a new report
exports.createReport = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      location, 
      latitude, 
      longitude, 
      isUrgent 
    } = req.body;

    // ✅ Fix: Get userId correctly from authenticated user
    const userId = req.user?.userId || req.user?.id || req.userId;
    
    if (!userId) {
      console.error('❌ User ID not found in request. req.user:', req.user);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found.'
      });
    }

    console.log('👤 Creating report for user:', userId);

    // ✅ Parse coordinates
    const parsedLat = latitude ? parseFloat(latitude) : null;
    const parsedLng = longitude ? parseFloat(longitude) : null;

    // ✅ Check if location was geo-tagged (has valid GPS coordinates)
    const hasGPSCoords = parsedLat !== null && 
                        parsedLng !== null && 
                        !isNaN(parsedLat) && 
                        !isNaN(parsedLng) &&
                        parsedLat >= -90 && parsedLat <= 90 &&
                        parsedLng >= -180 && parsedLng <= 180;

    // ✅ Parse isUrgent value
    const isUrgentValue = isUrgent === 'true' || isUrgent === true;

    // ✅ Set status based on urgency
    const reportStatus = isUrgentValue ? 'pending' : 'awaiting-approval';

    console.log('📍 Location data:', {
      location,
      latitude: parsedLat,
      longitude: parsedLng,
      hasGPSCoords
    });

    console.log('🚨 Report urgency:', {
      isUrgent: isUrgentValue,
      status: reportStatus
    });

    // Handle multiple images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file =>
        cloudinary.uploader.upload(file.path, {
          folder: 'fixitph-reports',
          resource_type: 'image'
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults.map(result => result.secure_url);

      console.log(`✅ Uploaded ${imageUrls.length} images to Cloudinary`);
    }

    const report = new Report({
      user: userId,
      title,
      description,
      category,
      location,
      latitude: parsedLat,
      longitude: parsedLng,
      geoTagged: hasGPSCoords,
      geoTaggedAt: hasGPSCoords ? new Date() : null,
      isUrgent: isUrgentValue,
      images: imageUrls,
      status: reportStatus, // ✅ Fixed: Use dynamic status based on urgency
    });

    await report.save();

    console.log('✅ Report created:', {
      id: report._id,
      user: userId,
      geoTagged: report.geoTagged,
      coordinates: report.geoTagged ? `${report.latitude}, ${report.longitude}` : 'Manual entry',
      isUrgent: report.isUrgent,
      status: report.status
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('❌ Create report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create report',
      error: error.message
    });
  }
};

// Update report status (for admins)
exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const reportId = req.params.id;

    // Handle non-resolved status updates normally
    if (status !== 'resolved') {
      if (!['pending', 'in-progress'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      const report = await Report.findByIdAndUpdate(
        reportId,
        { status },
        { new: true }
      ).populate('user', 'fName lName email profilePicture reputation');

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      return res.json(report);
    }

    // --- Handle 'resolved' status: Move the report ---
    console.log(`📦 Attempting to resolve and move report ID: ${reportId}`);
    
    // Find the original report
    const originalReport = await Report.findById(reportId).lean();
    if (!originalReport) {
      return res.status(404).json({ message: 'Original report not found to resolve' });
    }

    console.log('📄 Original report found:', {
      id: originalReport._id,
      title: originalReport.title,
      category: originalReport.category,
      user: originalReport.user,
      hasImages: originalReport.images?.length || 0,
      hasVideos: originalReport.videos?.length || 0,
      hasComments: originalReport.comments?.length || 0
    });

    // Create a new ResolvedReport document with ALL necessary fields
    const resolvedReportData = {
      originalReportId: originalReport._id,
      title: originalReport.title,
      description: originalReport.description,
      category: originalReport.category, // ADDED
      image: originalReport.image || (originalReport.images?.[0]) || null,
      images: originalReport.images || [], // ADDED
      videos: originalReport.videos || [], // ADDED
      location: originalReport.location,
      latitude: originalReport.latitude || null,
      longitude: originalReport.longitude || null,
      isUrgent: originalReport.isUrgent || false, // ADDED
      user: originalReport.user,
      comments: (originalReport.comments || []).map(c => ({
        userId: c.userId,
        user: c.user || c.author || 'Unknown',
        fName: c.fName || '',
        lName: c.lName || '',
        email: c.email || '',
        barangay: c.barangay || '',
        municipality: c.municipality || '',
        profilePicture: c.profilePicture || '',
        text: c.text || '',
        createdAt: c.createdAt || new Date()
      })),
      createdAt: originalReport.createdAt || new Date(),
      updatedAt: originalReport.updatedAt || new Date(), // ADDED
      resolvedAt: new Date(),
    };

    console.log('💾 Creating ResolvedReport with data:', {
      originalReportId: resolvedReportData.originalReportId,
      title: resolvedReportData.title,
      category: resolvedReportData.category,
      user: resolvedReportData.user,
      imagesCount: resolvedReportData.images.length,
      videosCount: resolvedReportData.videos.length,
      commentsCount: resolvedReportData.comments.length
    });

    const newResolvedReport = new ResolvedReport(resolvedReportData);
    
    // Save the new ResolvedReport
    await newResolvedReport.save();
    console.log(`✅ Report ${reportId} successfully saved to ResolvedReport collection.`);

    // Delete the original report from the main collection
    await Report.findByIdAndDelete(reportId);
    console.log(`✅ Original report ${reportId} deleted from Report collection.`);

    // Award reputation points to the user who reported it
    if (reputationController?.awardResolvedReport) {
      try {
        await reputationController.awardResolvedReport(originalReport.user);
        console.log('✅ Reputation awarded for resolved report');
      } catch (repError) {
        console.error('❌ Reputation award error:', repError);
      }
    }

    // Populate the user field before returning
    const populatedReport = await ResolvedReport.findById(newResolvedReport._id)
      .populate('user', 'fName lName email profilePicture reputation');

    console.log('🎉 Report successfully resolved and archived!');

    // Return a success response
    res.json({
      message: 'Report marked as resolved and archived successfully.',
      resolvedReport: populatedReport,
    });

  } catch (err) {
    console.error('❌ Update status error:', err);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// When admin verifies a report
exports.verifyReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?.userId || req.userId; // Fixed
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    report.isVerified = true;
    report.verifiedBy = userId;
    report.verifiedAt = new Date();
    await report.save();
    
    // Award reputation
    try {
      await reputationController.awardVerifiedReport(report.user);
      console.log('✅ Reputation awarded for verified report');
    } catch (repError) {
      console.error('❌ Reputation award error:', repError);
    }
    
    res.json({ message: 'Report verified', report });
  } catch (err) {
    console.error('Verify report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all reports with user details
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find({ status: { $ne: 'Rejected' } })
      .populate('user', 'fName lName email profilePicture reputation')
      .sort({ createdAt: -1 });

    // Normalize votedBy to always be strings
    const normalizedReports = reports.map(report => {
      const reportObj = report.toObject();
      
      // Ensure votedBy is an array of strings
      if (reportObj.votedBy) {
        reportObj.votedBy = reportObj.votedBy.map(id => id.toString());
      } else {
        reportObj.votedBy = [];
      }
      
      return reportObj;
    });

    res.json(normalizedReports);
  } catch (err) {
    console.error('Get all reports error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all pending reports
exports.getAllPendingReports = async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .select('-__v')
      .populate('user', 'fName lName email reputation');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all in-progress reports
exports.getAllInProgressReports = async (req, res) => {
  try {
    const reports = await Report.find({ status: 'in-progress' })
      .select('-__v')
      .populate('user', 'fName lName email reputation');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all resolved reports
exports.getAllResolvedReports = async (req, res) => {
  try {
    console.log('📋 Fetching all resolved reports...');

    const resolvedReports = await ResolvedReport.find()
      .populate('user', 'fName lName email profilePicture')
      .populate('resolvedBy', 'fName lName email')
      .sort({ resolvedAt: -1 });

    console.log(`✅ Found ${resolvedReports.length} resolved reports`);

    // ✅ Transform to match the frontend Report interface
    const transformedReports = resolvedReports.map(report => {
      // ✅ Get original images - check multiple fields for compatibility
      const originalImages = report.originalImages && report.originalImages.length > 0
        ? report.originalImages
        : report.images && report.images.length > 0
        ? report.images
        : report.image
        ? [report.image]
        : [];

      console.log(`Report ${report._id} images:`, {
        originalImages: report.originalImages?.length || 0,
        images: report.images?.length || 0,
        image: report.image ? 1 : 0,
        finalImages: originalImages.length
      });

      return {
        _id: report._id,
        title: report.title,
        description: report.description,
        category: report.category,
        location: report.location,
        latitude: report.latitude,
        longitude: report.longitude,
        status: 'resolved',
        user: report.user,
        isUrgent: report.isUrgent,
        // ✅ Include ALL image fields for maximum compatibility
        images: originalImages, // Main field used by frontend
        originalImages: originalImages, // Backup field
        image: report.image, // Legacy single image field
        videos: report.videos,
        comments: report.comments || [],
        // ✅ Resolution proof fields
        resolutionDescription: report.resolutionDescription,
        proofImages: report.proofImages || [],
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
        createdAt: report.createdAt,
        originalReportId: report.originalReportId,
        timestamp: report.resolvedAt || report.createdAt
      };
    });

    console.log('✅ Sample transformed report:', transformedReports[0]);

    res.json(transformedReports);
  } catch (error) {
    console.error('❌ Get resolved reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resolved reports',
      error: error.message
    });
  }
};

// return all resolved reports (from ResolvedReport collection)
exports.getResolvedReports = async (req, res) => {
  try {
    const resolved = await ResolvedReport.find().lean();
    return res.json(resolved);
  } catch (err) {
    console.error('getResolvedReport error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// return count of resolved reports (fast)
exports.getResolvedReportsCount = async (req, res) => {
  try {
    const count = await ResolvedReport.countDocuments();
    return res.json({ count });
  } catch (err) {
    console.error('getResolvedReportsCount error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get a report by ID
exports.getReport = async (req, res) => {
  try {
    const { id } = req.body;
    const report = await Report.findById(id)
      .select('-__v')
      .populate('user', 'fName lName email reputation');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
    console.error(err);
  }
};

// Get reports by user
exports.getReportByUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: 'userId is required' });
    }
    const reports = await Report.find({ user: id })
      .select('-__v')
      .populate('user', 'fName lName email reputation');
    if (!reports || reports.length === 0) {
      return res.status(404).json({ message: 'No reports found for this user' });
    }
    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
    console.error(err);
  }
};

// Get my reports
exports.getMyReports = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const reports = await Report.find({ user: userId })
      .populate('user', 'fName lName email profilePicture reputation')
      .sort({ createdAt: -1 });
    return res.status(200).json(reports);
  } catch (err) {
    console.error('getMyReports error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const reportId = req.params.id;
    const { text } = req.body;
    const userId = req.user?.userId || req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const comment = {
      userId,
      user: `${userDoc.fName || ''} ${userDoc.lName || ''}`.trim(),
      fName: userDoc.fName || '',
      lName: userDoc.lName || '',
      email: userDoc.email || '',
      barangay: userDoc.barangay || '',
      municipality: userDoc.municipality || '',
      profilePicture: userDoc.profilePicture?.url || '',
      text: text.trim(),
      createdAt: new Date(),
      editedAt: null
    };
    const report = await Report.findByIdAndUpdate(
      reportId,
      { $push: { comments: comment } },
      { new: true }
    );
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.status(200).json(normalizeComments(report.comments));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { id: reportId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user?.userId || req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const comment = findCommentById(report.comments, commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const commentOwnerId = resolveMongoIdString(comment.userId);
    if (!commentOwnerId || commentOwnerId !== String(userId)) {
      return res.status(403).json({ message: 'You can only edit your own comments' });
    }

    comment.text = text.trim();
    comment.editedAt = new Date();

    await report.save();

    const updatedReport = await Report.findById(reportId);

    return res.status(200).json(normalizeComments(updatedReport?.comments || []));
  } catch (err) {
    console.error('updateComment error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id: reportId, commentId } = req.params;
    const userId = req.user?.userId || req.userId;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const comment = findCommentById(report.comments, commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const commentOwnerId = resolveMongoIdString(comment.userId);
    if (!commentOwnerId || commentOwnerId !== String(userId)) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    if (typeof comment.remove === 'function') {
      comment.remove();
    } else if (comment._id || comment.id) {
      const targetId = resolveMongoIdString(comment._id || comment.id);
      report.comments = report.comments.filter((current) => {
        const currentId = resolveMongoIdString(current._id || current.id);
        return currentId !== targetId;
      });
    }

    await report.save();

    const updatedReport = await Report.findById(reportId);

    return res.status(200).json(normalizeComments(updatedReport?.comments || []));
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user?.userId || req.userId;
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    if (report.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this report' });
    }
    await Report.findByIdAndDelete(reportId);
    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
    console.error(err);
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, location, latitude, longitude, isUrgent } = req.body;
    const userId = req.user?.userId;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this report' });
    }

    // ✅ Handle multiple image uploads for update
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map(file => file.path);
      report.images = imageUrls;
      report.image = imageUrls[0]; // Keep first image for backward compatibility
    }

    report.title = title || report.title;
    report.description = description || report.description;
    report.category = category || report.category;
    report.location = location || report.location;
    report.latitude = latitude || report.latitude;
    report.longitude = longitude || report.longitude;
    report.isUrgent = isUrgent !== undefined ? (isUrgent === 'true' || isUrgent === true) : report.isUrgent;

    await report.save();

    const populatedReport = await Report.findById(id).populate('user', 'fName lName email profilePicture');

    res.status(200).json({ 
      message: 'Report updated successfully', 
      report: populatedReport 
    });
  } catch (err) {
    console.error('❌ Update report error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    console.log('📊 Generating report summary...');

    const [
      totalReports,
      pendingReports,
      inProgressReports,
      resolvedReports,
      awaitingApproval
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'in-progress' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'awaiting-approval' })
    ]);

    const summary = {
      total: totalReports,
      awaitingApproval,
      pending: pendingReports,
      inProgress: inProgressReports,
      resolved: resolvedReports
    };

    console.log('✅ Summary generated:', summary);
    res.json(summary);
  } catch (error) {
    console.error('❌ Get summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
      error: error.message
    });
  }
};

exports.getReportsForApproval = async (req, res) => {
  try {
    const reports = await Report.find({ status: 'awaiting-approval' })
      .populate('user', 'fName lName email profilePicture reputation') 
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error('getReportsForApproval error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.approveReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: 'pending' },
      { new: true }
    ).populate('user', 'fName lName email reputation');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    try {
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Report Approved!</h2>
          <p>Hi ${report.user.fName},</p>
          <p>Great news! Your report has been approved by our administrators and is now publicly visible.</p>
          <h3>Report Details:</h3>
          <ul>
            <li><strong>Report ID:</strong> ${report._id}</li>
            <li><strong>Title:</strong> ${report.title}</li>
            <li><strong>Status:</strong> Pending</li>
          </ul>
          <p>Our team will now review and work on resolving this issue. You will be notified of any updates.</p>
          <p>Thank you for helping improve our community!</p>
        </div>
      `;
      await sendEmailBrevo(
        report.user.email,
        `Your FixItPH Report Has Been Approved (ID: ${report._id})`,
        emailMessage,
      );
      console.log('📧 Approval email sent successfully to:', report.user.email);
    } catch (emailError) {
      console.error('❌ Failed to send approval email:', emailError);
    }
    res.json({ message: 'Report approved successfully', report });
  } catch (err) {
    console.error('approveReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.rejectReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('user', 'fName lName email reputation');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    const userInfo = {
      fName: report.user.fName,
      email: report.user.email,
    };
    const reportTitle = report.title;
    const reportId = report._id;
    await Report.findByIdAndDelete(req.params.id);
    try {
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Report Not Approved</h2>
          <p>Hi ${userInfo.fName},</p>
          <p>We regret to inform you that your report was not approved for public posting.</p>
          <h3>Report Details:</h3>
          <ul>
            <li><strong>Report ID:</strong> ${reportId}</li>
            <li><strong>Title:</strong> ${reportTitle}</li>
          </ul>
          <p><strong>Possible reasons for rejection:</strong></p>
          <ul>
            <li>The report did not meet our community guidelines</li>
            <li>The issue was duplicate or already reported</li>
            <li>Insufficient information provided</li>
            <li>The issue is outside the scope of our service</li>
          </ul>
          <p>If you believe this was a mistake or would like to resubmit with more details, please feel free to create a new report.</p>
          <p>Thank you for your understanding.</p>
        </div>
      `;
      await sendEmailBrevo(
        userInfo.email,
        `Your FixItPH Report Was Not Approved (ID: ${reportId})`,
        emailMessage,
      );
      console.log('📧 Rejection email sent successfully to:', userInfo.email);
    } catch (emailError) {
      console.error('❌ Failed to send rejection email:', emailError);
    }
    res.json({ message: 'Report rejected and deleted successfully' });
  } catch (err) {
    console.error('Reject report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add resolve report endpoint
exports.resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { description } = req.body;

    console.log('🔄 Resolving report:', reportId);

    // Find the original report
    const report = await Report.findById(reportId).populate('user', 'fName lName email');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // ✅ Get original images from the report
    const originalImages = report.images && report.images.length > 0
      ? report.images
      : report.image
      ? [report.image]
      : [];

    console.log('📸 Original report images:', originalImages.length);

    // ✅ Upload proof images to Cloudinary
    let proofImageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file =>
        cloudinary.uploader.upload(file.path, {
          folder: 'fixitph-resolved-proofs',
          resource_type: 'image'
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      proofImageUrls = uploadResults.map(result => result.secure_url);

      console.log(`✅ Uploaded ${proofImageUrls.length} proof images`);
    }

    // ✅ Create resolved report entry with BOTH original and proof images
    const resolvedReport = new ResolvedReport({
      originalReportId: report._id,
      title: report.title,
      description: report.description,
      category: report.category,
      location: report.location,
      latitude: report.latitude,
      longitude: report.longitude,
      user: report.user,
      // ✅ Store original images in multiple fields for compatibility
      originalImages: originalImages,
      images: originalImages, // Also store in 'images' field
      image: report.image, // Keep legacy single image field
      videos: report.videos,
      comments: report.comments || [],
      // ✅ Resolution data
      resolutionDescription: description,
      proofImages: proofImageUrls,
      resolvedBy: req.user.userId || req.user.id,
      resolvedAt: new Date(),
      createdAt: report.createdAt,
      isUrgent: report.isUrgent
    });

    await resolvedReport.save();

    console.log('✅ Resolved report saved:', {
      reportId: report._id,
      resolvedReportId: resolvedReport._id,
      originalImages: originalImages.length,
      proofImages: proofImageUrls.length
    });

    // ✅ Update original report status
    report.status = 'resolved';
    report.resolvedAt = new Date();
    await report.save();

    res.json({
      success: true,
      message: 'Report resolved successfully',
      resolvedReport: {
        ...resolvedReport.toObject(),
        images: originalImages, // Ensure images are included in response
        originalImages: originalImages,
        proofImages: proofImageUrls
      }
    });

  } catch (error) {
    console.error('❌ Resolve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve report',
      error: error.message
    });
  }
};

// Add these functions before the module.exports at the end of reportController.js

// Get flagged reports
exports.getFlaggedReports = async (req, res) => {
  try {
    console.log('🚩 Fetching flagged reports...');
    
    const flaggedReports = await Report.find({ 
      'flags.0': { $exists: true } // Reports that have at least one flag
    })
      .populate('user', 'fName lName email profilePicture')
      .populate('flags.userId', 'fName lName email')
      .sort({ 'flags.0.createdAt': -1 });

    console.log(`✅ Found ${flaggedReports.length} flagged reports`);
    res.json(flaggedReports);
  } catch (error) {
    console.error('❌ Get flagged reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged reports',
      error: error.message
    });
  }
};

// Flag a report
exports.flagReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Flag reason is required'
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user already flagged this report
    const alreadyFlagged = report.flags?.some(
      flag => flag.userId.toString() === userId.toString()
    );

    if (alreadyFlagged) {
      return res.status(400).json({
        success: false,
        message: 'You have already flagged this report'
      });
    }

    // Add flag
    const newFlag = {
      userId,
      reason: reason.trim(),
      description: description?.trim() || '',
      createdAt: new Date()
    };

    if (!report.flags) {
      report.flags = [];
    }

    report.flags.push(newFlag);
    await report.save();

    const populatedReport = await Report.findById(reportId)
      .populate('user', 'fName lName email profilePicture')
      .populate('flags.userId', 'fName lName email');

    console.log('🚩 Report flagged:', {
      reportId,
      userId,
      reason,
      totalFlags: report.flags.length
    });

    res.json({
      success: true,
      message: 'Report flagged successfully',
      report: populatedReport
    });
  } catch (error) {
    console.error('❌ Flag report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag report',
      error: error.message
    });
  }
};

// Dismiss a single flag
exports.dismissFlag = async (req, res) => {
  try {
    const { reportId, userId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Remove flag from specific user
    report.flags = report.flags.filter(
      flag => flag.userId.toString() !== userId.toString()
    );

    await report.save();

    const populatedReport = await Report.findById(reportId)
      .populate('user', 'fName lName email profilePicture')
      .populate('flags.userId', 'fName lName email');

    console.log('✅ Flag dismissed:', { reportId, userId });

    res.json({
      success: true,
      message: 'Flag dismissed successfully',
      report: populatedReport
    });
  } catch (error) {
    console.error('❌ Dismiss flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss flag',
      error: error.message
    });
  }
};

// Dismiss all flags for a report
exports.dismissAllFlags = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.flags = [];
    await report.save();

    const populatedReport = await Report.findById(reportId)
      .populate('user', 'fName lName email profilePicture');

    console.log('✅ All flags dismissed for report:', reportId);

    res.json({
      success: true,
      message: 'All flags dismissed successfully',
      report: populatedReport
    });
  } catch (error) {
    console.error('❌ Dismiss all flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss all flags',
      error: error.message
    });
  }
};

// AI Image Recognition
exports.aiImageRecognition = async (req, res) => {
  try {
    console.log("🖼️ Starting AI Image Recognition with Bytez...");
    
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        success: false,
        message: "Image URL is required" 
      });
    }

    console.log("📸 Processing image:", imageUrl);

    const apiKey = process.env.BYTEZ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false,
        message: "Bytez API key not configured" 
      });
    }

    const visionModels = [
      "Salesforce/blip-image-captioning-large",
      "nlpconnect/vit-gpt2-image-captioning",
      "microsoft/git-base"
    ];

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let result = null;
    let usedModel = null;

    for (let i = 0; i < visionModels.length; i++) {
      const modelName = visionModels[i];
      
      try {
        console.log(`🔍 Trying vision model ${i + 1}/${visionModels.length}: ${modelName}`);
        
        if (i > 0) {
          await delay(2000);
        }
        
        const model = bytezClient.model(modelName);
        const response = await model.run(imageUrl);

        console.log(`📦 Model ${modelName} response:`, response);

        if (response && typeof response === 'object' && response.error) {
          console.log(`❌ Model ${modelName} error:`, response.error);
          if (response.error.includes('rate limit') || response.error.includes('concurrency')) {
            await delay(5000);
          }
          continue;
        }

        let description = null;
        if (typeof response === 'string') {
          description = response;
        } else if (response && typeof response === 'object') {
          description = response.text || 
                       response.caption || 
                       response.generated_text || 
                       response[0]?.generated_text ||
                       response.output ||
                       response.summary_text;
        }

        if (description && description.trim().length > 0) {
          const descLower = description.toLowerCase();
          if (descLower.includes('upgrade') || 
              descLower.includes('unauthorized') || 
              descLower.includes('rate limit') ||
              descLower.includes('<!doctype')) {
            continue;
          }

          result = description.trim();
          usedModel = modelName;
          console.log(`✅ Successfully analyzed image with: ${modelName}`);
          break;
        }

      } catch (modelError) {
        console.log(`❌ Model ${modelName} failed:`, modelError.message);
        if (modelError.message.includes('rate limit')) {
          await delay(5000);
        }
        continue;
      }
    }

    if (!result) {
      return res.status(500).json({ 
        success: false,
        message: "All vision models failed to analyze the image"
      });
    }

    res.json({ 
      success: true,
      imageUrl,
      description: result,
      modelUsed: usedModel,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ AI Image Recognition failed:", error);
    res.status(500).json({ 
      success: false,
      message: "AI image recognition failed", 
      error: error.message
    });
  }
};

// Keep the module.exports as is - they now reference defined functions
module.exports = {
  createReport: exports.createReport,
  updateReportStatus: exports.updateReportStatus,
  verifyReport: exports.verifyReport,
  getAllReports: exports.getAllReports,
  getAllPendingReports: exports.getAllPendingReports,
  getAllInProgressReports: exports.getAllInProgressReports,
  getAllResolvedReports: exports.getAllResolvedReports,
  getResolvedReports: exports.getResolvedReports,
  getResolvedReportsCount: exports.getResolvedReportsCount,
  getReport: exports.getReport,
  getReportByUser: exports.getReportByUser,
  getMyReports: exports.getMyReports,
  addComment: exports.addComment,
  updateComment: exports.updateComment,
  deleteComment: exports.deleteComment,
  deleteReport: exports.deleteReport,
  updateReport: exports.updateReport,
  getReportsForApproval: exports.getReportsForApproval,
  approveReport: exports.approveReport,
  rejectReport: exports.rejectReport,
  resolveReport: exports.resolveReport,
  getSummary: exports.getSummary, // ✅ Add this
  getFlaggedReports: exports.getFlaggedReports, // ✅ Make sure this exists
  flagReport: exports.flagReport, // ✅ Make sure this exists
  dismissFlag: exports.dismissFlag, // ✅ Make sure this exists
  dismissAllFlags: exports.dismissAllFlags, // ✅ Make sure this exists
  aiImageRecognition: exports.aiImageRecognition // ✅ Make sure this exists
};