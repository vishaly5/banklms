import Batch from '../models/Batch.model.js';
import Department from '../models/Department.model.js';
import User from '../models/User.model.js';
import Participant from '../models/Participant.model.js';
import Enrollment from '../models/Enrollment.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import ErrorResponse from '../utils/errorResponse.js';
import {
  enrollParticipantInBatchCourses,
  updateBatchStudentCount,
} from '../services/batchCourseSync.service.js';

const getBatchParamId = (req) => req.params.batchId || req.params.id;

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getParticipantName = (participant) =>
  [participant.firstName, participant.lastName].filter(Boolean).join(' ').trim()
  || participant.name
  || participant.fullName
  || 'Student';

const getStudentKey = (student) => student.email?.toLowerCase() || String(student._id);

const buildParticipantSearchFilter = (search) => {
  if (!search) return {};
  const regex = new RegExp(escapeRegex(search), 'i');
  return {
    $or: [
      { firstName: regex },
      { lastName: regex },
      { name: regex },
      { fullName: regex },
      { email: regex },
      { mobile: regex },
      { phone: regex },
      { uniqueId: regex },
      { enrollmentNumber: regex },
      { rollNumber: regex },
      { registrationNumber: regex },
    ],
  };
};

const formatBatchSummary = (batch) => ({
  _id: batch._id,
  name: batch.name,
  code: batch.code,
  department: batch.department,
});

const formatParticipantForBatch = (participant, batchId) => {
  const assignedBatch = participant.batch && typeof participant.batch === 'object' ? participant.batch : null;
  return {
    _id: participant._id,
    name: getParticipantName(participant),
    fullName: getParticipantName(participant),
    firstName: participant.firstName,
    lastName: participant.lastName,
    email: participant.email,
    phone: participant.phone || participant.mobile,
    mobile: participant.mobile || participant.phone,
    enrollmentNumber: participant.enrollmentNumber || participant.uniqueId,
    rollNumber: participant.rollNumber,
    registrationNumber: participant.registrationNumber,
    uniqueId: participant.uniqueId,
    department: participant.department,
    batch: assignedBatch?._id || participant.batch || null,
    assignedBatch: assignedBatch?._id || participant.batch || null,
    assignedBatchName: assignedBatch ? `${assignedBatch.name} (${assignedBatch.code})` : null,
    isAssignedToThisBatch: String(assignedBatch?._id || participant.batch || '') === String(batchId),
    enrolledCourses: participant.enrolledCourses || [],
    isActive: participant.isActive,
    isApproved: participant.isApproved,
    source: 'Participant',
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
};

const mergeStudentsByEmail = (students) => {
  const studentsMap = new Map();
  students.forEach((student) => {
    const key = getStudentKey(student);
    if (!studentsMap.has(key) || student.source === 'User') {
      studentsMap.set(key, student);
    }
  });
  return Array.from(studentsMap.values());
};

const formatUserForBatch = (user, batchId) => {
  const assignedBatch = user.batch && typeof user.batch === 'object' ? user.batch : null;
  return {
    _id: user._id,
    name: getParticipantName(user),
    fullName: getParticipantName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || user.mobile,
    mobile: user.mobile || user.phone,
    enrollmentNumber: user.enrollmentNumber || user.uniqueId,
    rollNumber: user.rollNumber,
    registrationNumber: user.registrationNumber,
    uniqueId: user.uniqueId,
    department: user.department,
    batch: assignedBatch?._id || user.batch || null,
    assignedBatch: assignedBatch?._id || user.batch || null,
    assignedBatchName: assignedBatch ? `${assignedBatch.name} (${assignedBatch.code})` : null,
    isAssignedToThisBatch: String(assignedBatch?._id || user.batch || '') === String(batchId),
    enrolledCourses: user.enrolledCourses || [],
    isActive: user.isActive,
    isApproved: user.isApproved,
    source: 'User',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * @desc    Create a new batch
 * @route   POST /api/v1/batches
 * @access  Private (admin only)
 */
export const createBatch = asyncHandler(async (req, res, next) => {
  const { name, code, department, year, startDate, endDate, maxStudents, coordinator } = req.body;

  if (!name || !code || !department || !year) {
    return next(new ErrorResponse('Name, code, department, and year are required', 400));
  }

  // Validate department exists
  const dept = await Department.findById(department);
  if (!dept) {
    return next(new ErrorResponse('Department not found', 404));
  }

  // Check if batch with same code exists
  const existing = await Batch.findOne({ code: code.toUpperCase() });
  if (existing) {
    return next(new ErrorResponse('Batch with this code already exists', 400));
  }

  const batch = await Batch.create({
    name,
    code: code.toUpperCase(),
    department,
    year,
    startDate,
    endDate,
    maxStudents,
    coordinator,
    createdBy: req.user._id
  });

  await batch.populate([
    { path: 'department', select: 'name code' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Batch created successfully',
    data: batch
  });
});

/**
 * @desc    Get all batches
 * @route   GET /api/v1/batches
 * @access  Private
 */
export const getBatches = asyncHandler(async (req, res) => {
  const { department, year, isActive, search, page = 1, limit = 50 } = req.query;

  const filter = {};

  if (department) {
    filter.department = department;
  }

  if (year) {
    filter.year = Number(year);
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [batches, total] = await Promise.all([
    Batch.find(filter)
      .populate('department', 'name code')
      .populate('course', 'title thumbnail')
      .populate('trainers', 'firstName lastName email')
      .populate('courses', 'title')
      .sort({ year: -1, name: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Batch.countDocuments(filter)
  ]);

  const batchIds = batches.map((batch) => batch._id);
  const [participantCounts, userCounts] = await Promise.all([
    Participant.aggregate([
      { $match: { batch: { $in: batchIds }, isActive: true } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: 'student', batch: { $in: batchIds }, isActive: true } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]),
  ]);
  const studentCountMap = new Map();
  [...participantCounts, ...userCounts].forEach((item) => {
    const key = String(item._id);
    studentCountMap.set(key, (studentCountMap.get(key) || 0) + item.count);
  });
  const enrichedBatches = batches.map((batch) => ({
    ...batch,
    currentStudents: studentCountMap.get(String(batch._id)) ?? batch.currentStudents ?? 0,
    assignedCoursesCount: Array.isArray(batch.courses) ? batch.courses.length : 0,
    assignedTrainersCount: Array.isArray(batch.trainers) ? batch.trainers.length : 0,
  }));

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: enrichedBatches
  });
});

/**
 * @desc    Get single batch
 * @route   GET /api/v1/batches/:id
 * @access  Private
 */
export const getBatch = asyncHandler(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id)
    .populate('department', 'name code')
    .populate('course', 'title thumbnail')
    .populate('trainers', 'firstName lastName email')
    .lean();

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  // Get actual student count
  const [participantCount, userCount] = await Promise.all([
    Participant.countDocuments({ batch: req.params.id, isActive: true }),
    User.countDocuments({ role: 'student', batch: req.params.id, isActive: true }),
  ]);
  const studentCount = participantCount + userCount;

  res.status(200).json({
    success: true,
    data: {
      ...batch,
      currentStudents: studentCount
    }
  });
});

/**
 * @desc    Update batch
 * @route   PUT /api/v1/batches/:id
 * @access  Private (admin only)
 */
export const updateBatch = asyncHandler(async (req, res, next) => {
  let batch = await Batch.findById(req.params.id);

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  const { name, code, department, year, startDate, endDate, maxStudents, coordinator, isActive, trainers } = req.body;

  // Check for duplicate code (excluding current batch)
  if (code) {
    const existing = await Batch.findOne({
      _id: { $ne: req.params.id },
      code: code.toUpperCase()
    });

    if (existing) {
      return next(new ErrorResponse('Batch with this code already exists', 400));
    }
  }

  // Validate department if provided
  if (department) {
    const dept = await Department.findById(department);
    if (!dept) {
      return next(new ErrorResponse('Department not found', 404));
    }
  }

  batch = await Batch.findByIdAndUpdate(
    req.params.id,
    {
      ...(name && { name }),
      ...(code && { code: code.toUpperCase() }),
      ...(department && { department }),
      ...(year && { year }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(maxStudents !== undefined && { maxStudents }),
      ...(coordinator !== undefined && { coordinator }),
      ...(isActive !== undefined && { isActive }),
      ...(trainers !== undefined && { trainers })
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'department', select: 'name code' },
    { path: 'trainers', select: 'firstName lastName email' }
  ]);

  res.status(200).json({
    success: true,
    message: 'Batch updated successfully',
    data: batch
  });
});

/**
 * @desc    Delete batch
 * @route   DELETE /api/v1/batches/:id
 * @access  Private (admin only)
 */
export const deleteBatch = asyncHandler(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id);

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  // Check if batch has students
  const [userStudentCount, participantStudentCount] = await Promise.all([
    User.countDocuments({ batch: req.params.id }),
    Participant.countDocuments({ batch: req.params.id, isActive: true })
  ]);
  const studentCount = userStudentCount + participantStudentCount;
  if (studentCount > 0) {
    return next(new ErrorResponse(
      `Cannot delete batch with ${studentCount} assigned student(s). Please reassign students first.`,
      400
    ));
  }

  await batch.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Batch deleted successfully'
  });
});

/**
 * @desc    Get students in a batch
 * @route   GET /api/v1/batches/:id/students
 * @access  Private
 */
export const getBatchStudents = asyncHandler(async (req, res, next) => {
  const batchId = getBatchParamId(req);
  const { search, page = 1, limit = 20 } = req.query;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;

  const batch = await Batch.findById(batchId).populate('department', 'name code').lean();

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  const filter = {
    batch: batchId,
    isActive: true,
    ...buildParticipantSearchFilter(search),
  };
  const userFilter = {
    role: 'student',
    batch: batchId,
    isActive: true,
    ...buildParticipantSearchFilter(search),
  };

  const [participants, userStudents, participantTotal, userTotal] = await Promise.all([
    Participant.find(filter)
      .populate('department', 'name code')
      .populate('batch', 'name code')
      .select('firstName lastName name fullName email mobile phone uniqueId enrollmentNumber rollNumber registrationNumber department batch enrolledCourses isActive createdAt updatedAt')
      .sort({ firstName: 1, lastName: 1, email: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    User.find(userFilter)
      .populate('department', 'name code')
      .populate('batch', 'name code')
      .select('firstName lastName name fullName email mobile phone uniqueId enrollmentNumber rollNumber registrationNumber department batch enrolledCourses isActive isApproved createdAt updatedAt')
      .sort({ firstName: 1, lastName: 1, email: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    Participant.countDocuments(filter),
    User.countDocuments(userFilter),
  ]);
  const total = participantTotal + userTotal;

  const enrollmentCounts = await Enrollment.aggregate([
    { $match: { user: { $in: [...participants, ...userStudents].map((student) => student._id) } } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
  ]);
  const enrollmentCountMap = new Map(enrollmentCounts.map((item) => [String(item._id), item.count]));
  const students = mergeStudentsByEmail([
    ...participants.map((participant) => ({
      ...formatParticipantForBatch(participant, batchId),
      courseCount: enrollmentCountMap.get(String(participant._id)) || participant.enrolledCourses?.length || 0,
    })),
    ...userStudents.map((user) => ({
      ...formatUserForBatch(user, batchId),
      courseCount: enrollmentCountMap.get(String(user._id)) || user.enrolledCourses?.length || 0,
    })),
  ]).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  res.status(200).json({
    success: true,
    count: students.length,
    data: {
      batch: formatBatchSummary(batch),
      students,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    },
  });
});

/**
 * @desc    Search assignable students/participants for a batch
 * @route   GET /api/v1/batches/:batchId/assignable-students
 * @access  Private (admin only)
 */
export const getAssignableStudents = asyncHandler(async (req, res, next) => {
  const batchId = getBatchParamId(req);
  const {
    search,
    page = 1,
    limit = 20,
    department,
    status,
    onlyUnassigned = 'true',
  } = req.query;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;

  const batch = await Batch.findById(batchId).populate('department', 'name code').lean();
  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  const filter = {
    isActive: true,
    ...buildParticipantSearchFilter(search),
  };
  const userFilter = {
    role: 'student',
    isActive: true,
    ...buildParticipantSearchFilter(search),
  };

  if (onlyUnassigned === 'true') {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ batch: null }, { batch: { $exists: false } }] },
    ];
    userFilter.$and = [
      ...(userFilter.$and || []),
      { $or: [{ batch: null }, { batch: { $exists: false } }] },
    ];
  }

  if (department) {
    filter.department = department;
    userFilter.department = department;
  }

  if (status === 'approved') filter.isApproved = true;
  if (status === 'pending') filter.isApproved = false;
  if (status === 'approved') userFilter.isApproved = true;
  if (status === 'pending') userFilter.isApproved = false;

  const sort = batch.department?._id
    ? { department: -1, firstName: 1, lastName: 1, email: 1 }
    : { firstName: 1, lastName: 1, email: 1 };

  const [participants, userStudents, participantTotal, userTotal] = await Promise.all([
    Participant.find(filter)
      .populate('department', 'name code')
      .populate('batch', 'name code')
      .select('firstName lastName name fullName email mobile phone uniqueId enrollmentNumber rollNumber registrationNumber department batch enrolledCourses isActive isApproved createdAt updatedAt')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    User.find(userFilter)
      .populate('department', 'name code')
      .populate('batch', 'name code')
      .select('firstName lastName name fullName email mobile phone uniqueId enrollmentNumber rollNumber registrationNumber department batch enrolledCourses isActive isApproved createdAt updatedAt')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    Participant.countDocuments(filter),
    User.countDocuments(userFilter),
  ]);
  const total = participantTotal + userTotal;

  const students = mergeStudentsByEmail([
    ...participants.map((participant) => formatParticipantForBatch(participant, batchId)),
    ...userStudents.map((user) => formatUserForBatch(user, batchId)),
  ])
    .sort((a, b) => {
      const aSameDepartment = String(a.department?._id || a.department || '') === String(batch.department?._id || batch.department || '');
      const bSameDepartment = String(b.department?._id || b.department || '') === String(batch.department?._id || batch.department || '');
      if (aSameDepartment !== bSameDepartment) return aSameDepartment ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  res.status(200).json({
    success: true,
    data: {
      batch: formatBatchSummary(batch),
      students,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    },
  });
});

/**
 * @desc    Assign students to batch
 * @route   POST /api/v1/batches/:id/assign
 * @access  Private (admin only)
 */
export const assignStudentsToBatch = asyncHandler(async (req, res, next) => {
  const batchId = getBatchParamId(req);
  const studentIds = [...new Set(req.body.participantIds || req.body.studentIds || [])];

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return next(new ErrorResponse('Please provide an array of participantIds', 400));
  }

  const batch = await Batch.findById(batchId);

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  const [participants, userStudents] = await Promise.all([
    Participant.find({
      _id: { $in: studentIds },
      isActive: true
    }).select('_id').lean(),
    User.find({
      _id: { $in: studentIds },
      role: 'student',
      isActive: true
    }).select('_id').lean(),
  ]);
  const foundStudentIds = new Set([
    ...participants.map((student) => String(student._id)),
    ...userStudents.map((student) => String(student._id)),
  ]);

  if (foundStudentIds.size !== studentIds.length) {
    return next(new ErrorResponse('One or more students were not found or inactive', 400));
  }
  const participantIds = participants.map((student) => student._id);
  const userIds = userStudents.map((student) => student._id);

  // Check if batch has capacity
  if (batch.maxStudents) {
    const [participantCurrentCount, userCurrentCount, participantAlreadyInBatch, userAlreadyInBatch] = await Promise.all([
      Participant.countDocuments({ batch: batchId, isActive: true }),
      User.countDocuments({ role: 'student', batch: batchId, isActive: true }),
      Participant.countDocuments({
        _id: { $in: participantIds },
        batch: batchId,
        isActive: true,
      }),
      User.countDocuments({
        _id: { $in: userIds },
        role: 'student',
        batch: batchId,
        isActive: true,
      }),
    ]);
    const currentCount = participantCurrentCount + userCurrentCount;
    const alreadyInBatch = participantAlreadyInBatch + userAlreadyInBatch;
    const newTotal = currentCount + (studentIds.length - alreadyInBatch);
    
    if (newTotal > batch.maxStudents) {
      return next(new ErrorResponse(
        `Batch capacity exceeded. Available seats: ${batch.maxStudents - currentCount}`,
        400
      ));
    }
  }

  const [participantResult, userResult] = await Promise.all([
    Participant.updateMany(
      { _id: { $in: participantIds }, isActive: true },
      { $set: { batch: batchId, department: batch.department } }
    ),
    User.updateMany(
      { _id: { $in: userIds }, role: 'student', isActive: true },
      { $set: { batch: batchId, department: batch.department } }
    ),
  ]);

  const currentStudents = await updateBatchStudentCount(batchId);
  const syncSummary = await enrollParticipantInBatchCourses({
    participantIds,
    userIds,
    batchId,
    assignedBy: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: 'Students assigned successfully. Existing batch courses have also been added to their My Courses.',
    data: {
      assignedCount: (participantResult.modifiedCount || 0) + (userResult.modifiedCount || 0),
      batchId,
      batchCoursesFound: syncSummary.coursesFound,
      enrollmentsCreated: syncSummary.enrollmentsCreated,
      duplicatesSkipped: syncSummary.duplicatesSkipped,
      currentStudents
    }
  });
});

/**
 * @desc    Remove students from batch
 * @route   POST /api/v1/batches/:id/remove
 * @access  Private (admin only)
 */
export const removeStudentsFromBatch = asyncHandler(async (req, res, next) => {
  const batchId = getBatchParamId(req);
  const studentIds = req.body.participantIds || req.body.studentIds;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return next(new ErrorResponse('Please provide an array of participantIds', 400));
  }

  const batch = await Batch.findById(batchId);

  if (!batch) {
    return next(new ErrorResponse('Batch not found', 404));
  }

  const [participantResult, userResult] = await Promise.all([
    Participant.updateMany(
      { _id: { $in: studentIds }, batch: batchId },
      { $unset: { batch: 1 } }
    ),
    User.updateMany(
      { _id: { $in: studentIds }, role: 'student', batch: batchId },
      { $unset: { batch: 1 } }
    ),
  ]);

  const currentStudents = await updateBatchStudentCount(batchId);

  res.status(200).json({
    success: true,
    message: 'Students removed from batch. Existing course enrollments were not removed.',
    data: {
      removedCount: (participantResult.modifiedCount || 0) + (userResult.modifiedCount || 0),
      currentStudents,
      note: 'Students removed from batch. Existing course enrollments were not removed.',
    }
  });
});
