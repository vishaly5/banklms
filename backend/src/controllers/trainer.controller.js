import Batch from '../models/Batch.model.js';
import Participant from '../models/Participant.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import ErrorResponse from '../utils/errorResponse.js';

/**
 * @desc    Get students from trainer's assigned batches
 * @route   GET /api/v1/trainer/students
 * @access  Private/Trainer
 */
export const getMyStudents = asyncHandler(async (req, res, next) => {
  const trainerId = req.user._id;

  // Find all batches where this trainer is assigned
  const batches = await Batch.find({ trainers: trainerId })
    .select('_id name code department year')
    .populate('department', 'name code')
    .lean();

  if (!batches || batches.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No batches assigned to this trainer',
      count: 0,
      batches: 0,
      data: []
    });
  }

  const batchIds = batches.map(b => b._id);

  const students = await Participant.find({
    batch: { $in: batchIds },
    isActive: true
  })
    .select('-password')
    .populate('batch', 'name code')
    .populate('department', 'name code')
    .populate('enrolledCourses', 'title thumbnail status')
    .lean();

  students.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  // Add batch info to each student
  const studentsWithBatchInfo = students.map(student => {
    const batch = batches.find(b => b._id.toString() === student.batch?._id?.toString());
    return {
      ...student,
      batchInfo: batch || student.batch
    };
  });

  res.status(200).json({
    success: true,
    count: studentsWithBatchInfo.length,
    batches: batches.length,
    data: studentsWithBatchInfo
  });
});

/**
 * @desc    Get student details
 * @route   GET /api/v1/trainer/students/:id
 * @access  Private/Trainer
 */
export const getStudentDetails = asyncHandler(async (req, res, next) => {
  const trainerId = req.user._id;
  const studentId = req.params.id;

  const student = await Participant.findById(studentId)
    .select('-password')
    .populate('batch', 'name code')
    .populate('department', 'name code')
    .populate('enrolledCourses', 'title thumbnail')
    .populate('completedCourses', 'title thumbnail')
    .lean();

  if (!student) {
    return next(new ErrorResponse('Student not found', 404));
  }

  // Verify trainer has access to this student (student must be in trainer's batch)
  const hasAccess = await Batch.findOne({
    _id: student.batch,
    trainers: trainerId
  });

  if (!hasAccess) {
    return next(new ErrorResponse('You do not have access to this student', 403));
  }

  res.status(200).json({
    success: true,
    data: student
  });
});

export default {
  getMyStudents,
  getStudentDetails
};
