import Course from '../models/Course.model.js';
import Enrollment from '../models/Enrollment.model.js';
import User from '../models/User.model.js';
import Participant from '../models/Participant.model.js';

const isObjectIdLike = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const normalizeId = (value) => String(value?._id || value || '').trim();

const getStudentIdentityFilter = async (user) => {
  const [userDoc, participant] = await Promise.all([
    User.findById(user._id).select('_id batch').lean(),
    Participant.findOne({
      $or: [
        { _id: user._id },
        ...(user.email ? [{ email: String(user.email).toLowerCase() }] : []),
        ...(user.mobile ? [{ mobile: user.mobile }] : []),
      ],
    }).select('_id batch').lean(),
  ]);
  const batchIds = [
    userDoc?.batch,
    participant?.batch,
    user?.batch,
  ]
    .map(normalizeId)
    .filter(isObjectIdLike);

  return {
    participantId: participant?._id || null,
    enrollmentUserIds: participant?._id ? [user._id, participant._id] : [user._id],
    batchIds: [...new Set(batchIds)],
  };
};

const ensurePublishedBatchCourseEnrollments = async ({ user, participantId, enrollmentUserIds, batchIds }) => {
  if (!batchIds?.length) return { coursesFound: 0, enrollmentsCreated: 0 };

  const batchCourses = await Course.find({
    isPublished: true,
    status: 'active',
    batchAssigned: true,
    batches: { $in: batchIds },
    $or: [{ reviewStatus: 'published' }, { reviewStatus: { $exists: false } }],
  }).select('_id').lean();

  if (!batchCourses.length) return { coursesFound: 0, enrollmentsCreated: 0 };

  const courseIds = batchCourses.map((course) => course._id);
  const existingEnrollments = await Enrollment.find({
    course: { $in: courseIds },
    $or: [
      { user: { $in: enrollmentUserIds } },
      ...(participantId ? [{ participant: participantId }] : []),
    ],
    status: { $ne: 'dropped' },
  }).select('course').lean();
  const existingCourseIds = new Set(existingEnrollments.map((enrollment) => String(enrollment.course)));
  const missingCourseIds = courseIds.filter((courseId) => !existingCourseIds.has(String(courseId)));

  if (!missingCourseIds.length) {
    return { coursesFound: courseIds.length, enrollmentsCreated: 0 };
  }

  const primaryBatchId = batchIds[0];
  let enrollmentsCreated = 0;
  for (const courseId of missingCourseIds) {
    const existing = await Enrollment.findOne({
      course: courseId,
      $or: [
        { user: { $in: enrollmentUserIds } },
        ...(participantId ? [{ participant: participantId }] : []),
      ],
    }).select('_id').lean();

    if (existing) continue;

    const created = await Enrollment.findOneAndUpdate(
      { user: user._id, course: courseId },
      {
        $setOnInsert: {
          user: user._id,
          ...(participantId ? { participant: participantId } : {}),
          course: courseId,
          batch: primaryBatchId,
          source: 'batch',
          status: 'enrolled',
          progressPercent: 0,
          enrolledAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (created) enrollmentsCreated += 1;
  }

  return {
    coursesFound: courseIds.length,
    enrollmentsCreated,
  };
};

/**
 * @desc    Get all global courses (active and published only)
 * @route   GET /api/v1/student/courses/global
 * @access  Private (Student)
 */
export const getGlobalCourses = async (req, res) => {
  try {
    const { search = '', category = '', sort = 'recent', page = 1, limit = 12 } = req.query;

    const query = {
      status: 'active',
      $and: [
        {
          $or: [
            { isPublished: true },
            { reviewStatus: 'published' },
            { reviewStatus: { $exists: false }, visibility: { $ne: 'private' } },
          ],
        },
        {
          $or: [
            { accessType: 'marketplace' },
            { accessType: { $exists: false } },
            { accessType: null },
          ],
        },
        {
          $or: [
            { isMarketplaceVisible: { $ne: false } },
            { isMarketplaceVisible: { $exists: false } },
          ],
        },
        {
          $or: [
            { isGlobalVisible: { $ne: false } },
            { isGlobalVisible: { $exists: false } },
          ],
        },
        {
          $or: [
            { batchAssigned: { $ne: true } },
            { batchAssigned: { $exists: false } },
          ],
        },
      ],
    };

    if (category && category !== 'all') {
      // Handle case-insensitive matching for category
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');

      // Find teachers/trainers whose names or emails match the search query
      const matchingTeachers = await User.find({
        role: { $in: ['trainer', 'teacher', 'administrator'] },
        $or: [
          { name: searchRegex },
          { fullName: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');

      const teacherIds = matchingTeachers.map(t => t._id);

      query.$and.push({
        $or: [
          { title: searchRegex },
          { category: searchRegex },
          { subtitle: searchRegex },
          { description: searchRegex },
          { fullDescription: searchRegex },
          { overview: searchRegex },
          { createdBy: { $in: teacherIds } },
          { trainer: { $in: teacherIds } }
        ],
      });
    }

    const limitNum = parseInt(limit, 10) || 12;
    const pageNum = parseInt(page, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    // Sorting options
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'alphabetical') {
      sortOption = { title: 1 };
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .select('title subtitle description fullDescription overview category level language tags thumbnail currentEnrollments accessType isMarketplaceVisible isGlobalVisible batchAssigned assignmentSource trainer statistics ratings createdBy createdAt sections')
        .populate('trainer', 'name email firstName lastName fullName')
        .populate('createdBy', 'name email firstName lastName fullName')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Course.countDocuments(query)
    ]);

    // Fetch student's enrollments to map status & progress
    const { participantId, enrollmentUserIds } = await getStudentIdentityFilter(req.user);
    const enrollmentQuery = {
      status: { $ne: 'dropped' }
    };
    enrollmentQuery.$or = [
      { user: { $in: enrollmentUserIds } },
      ...(participantId ? [{ participant: participantId }] : []),
    ];
    const enrollments = await Enrollment.find(enrollmentQuery).lean();

    const enrolledMap = new Map(enrollments.map(e => [e.course.toString(), e]));

    const coursesWithEnrollment = courses.map(course => {
      const enrollment = enrolledMap.get(course._id.toString());
      const totalLessons = (course.sections || []).reduce((sum, s) => sum + (s.lessons?.length || 0), 0);
      
      let teacherName = 'Unknown Instructor';
      const t = course.trainer || course.createdBy;
      if (t) {
        teacherName = t.fullName || t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email || 'Instructor';
      }

      return {
        _id: course._id,
        title: course.title,
        subtitle: course.subtitle,
        category: course.category,
        thumbnail: course.thumbnail,
        shortDescription: course.description || course.subtitle || '',
        description: course.description,
        fullDescription: course.fullDescription,
        overview: course.overview,
        teacherName,
        createdBy: course.createdBy || course.trainer,
        lessonsCount: totalLessons,
        duration: course.duration || 'TBD',
        enrolledCount: course.currentEnrollments || course.statistics?.totalEnrollments || 0,
        rating: course.ratings?.average || 0,
        isEnrolled: !!enrollment,
        enrollmentStatus: enrollment ? enrollment.status : null,
        enrollmentSource: enrollment ? enrollment.source : null,
        progress: enrollment ? (enrollment.progressPercent ?? enrollment.progress ?? 0) : 0,
        sections: course.sections || [],
        level: course.level,
        language: course.language
      };
    });

    res.status(200).json({
      success: true,
      courses: coursesWithEnrollment,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('getGlobalCourses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get only enrolled courses for the logged-in student
 * @route   GET /api/v1/student/my-courses
 * @access  Private (Student)
 */
export const getMyCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    const { participantId, enrollmentUserIds, batchIds } = await getStudentIdentityFilter(req.user);
    await ensurePublishedBatchCourseEnrollments({
      user: req.user,
      participantId,
      enrollmentUserIds,
      batchIds,
    });

    // Fetch enrollments that are active, in-progress, completed, etc.
    const enrollments = await Enrollment.find({
      $or: [
        { user: { $in: enrollmentUserIds } },
        ...(participantId ? [{ participant: participantId }] : []),
      ],
      status: { $in: ['enrolled', 'in-progress', 'completed', 'active'] }
    })
      .populate({
        path: 'course',
        select: 'title subtitle description fullDescription overview category level language tags thumbnail currentEnrollments accessType isMarketplaceVisible isGlobalVisible batchAssigned assignmentSource trainer statistics ratings createdBy createdAt updatedAt status reviewStatus isPublished unpublishedAt sections',
        populate: [
          { path: 'trainer', select: 'name email firstName lastName fullName' },
          { path: 'createdBy', select: 'name email firstName lastName fullName' }
        ]
      })
      .sort({ lastAccessAt: -1 })
      .lean();

    const courses = enrollments
      .map(e => {
        const course = e.course;
        if (!course) return null;

        const totalLessons = (course.sections || []).reduce((sum, s) => sum + (s.lessons?.length || 0), 0);
        const completedLessons = (e.lessonProgress || []).filter(lp => lp.completed).length;
        
        let teacherName = 'Unknown Instructor';
        const t = course.trainer || course.createdBy;
        if (t) {
          teacherName = t.fullName || t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email || 'Instructor';
        }

        return {
          _id: course._id,
          enrollmentId: e._id,
          title: course.title,
          subtitle: course.subtitle,
          category: course.category,
          thumbnail: course.thumbnail,
          shortDescription: course.description || course.subtitle || '',
          description: course.description,
          fullDescription: course.fullDescription,
          overview: course.overview,
          teacherName,
          lessonsCount: totalLessons,
          completedLessonsCount: completedLessons,
          duration: course.duration || 'TBD',
          enrolledCount: course.currentEnrollments || course.statistics?.totalEnrollments || 0,
          rating: course.ratings?.average || 0,
          status: course.status,
          reviewStatus: course.reviewStatus,
          isPublished: course.isPublished,
          accessType: course.accessType,
          isMarketplaceVisible: course.isMarketplaceVisible,
          isGlobalVisible: course.isGlobalVisible,
          batchAssigned: course.batchAssigned,
          assignmentSource: course.assignmentSource,
          unpublishedAt: course.unpublishedAt,
          updatedAt: course.updatedAt,
          progress: e.progressPercent ?? e.progress ?? 0,
          enrollmentStatus: e.status,
          enrollmentSource: e.source,
          enrollmentBatch: e.batch,
          enrolledAt: e.enrolledAt,
          lastAccessAt: e.lastAccessAt,
          sections: course.status === 'archived' ? [] : (course.sections || []),
          archivedAccess: course.status === 'archived',
          archiveMessage: course.status === 'archived'
            ? 'This course has been archived by the trainer. Your enrollment and progress are saved, but course content is currently unavailable.'
            : ''
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('getMyCourses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Enroll in a course
 * @route   POST /api/v1/student/courses/:courseId/enroll
 * @access  Private (Student)
 */
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;
    const { participantId, enrollmentUserIds } = await getStudentIdentityFilter(req.user);

    // Verify user role is student or participant
    if (req.user.role !== 'student' && req.user.role !== 'participant') {
      return res.status(403).json({ success: false, message: 'Only students can enroll in courses' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if course is published and active
    const approved = course.isPublished && course.status === 'active' && (course.reviewStatus === 'published' || !course.reviewStatus);
    if (!approved) {
      return res.status(400).json({ success: false, message: 'This course is not active or published yet' });
    }

    if (course.batchAssigned || course.accessType === 'batch_assigned' || course.isMarketplaceVisible === false) {
      return res.status(403).json({
        success: false,
        message: 'This course is assigned through batches and is not open for marketplace enrollment'
      });
    }

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      course: courseId,
      $or: [
        { user: { $in: enrollmentUserIds } },
        ...(participantId ? [{ participant: participantId }] : []),
      ],
    });
    if (existing) {
      if (existing.status === 'dropped') {
        existing.status = 'enrolled';
        existing.enrolledAt = new Date();
        await existing.save();
        return res.status(200).json({
          success: true,
          message: 'Re-enrolled successfully',
          enrollment: {
            _id: existing._id,
            student: existing.user,
            course: existing.course,
            status: existing.status,
            progress: existing.progressPercent,
            enrolledAt: existing.enrolledAt
          }
        });
      }

      return res.status(200).json({
        success: true,
        alreadyEnrolled: true,
        message: 'You are already enrolled in this course'
      });
    }

    // Check max students limit
    if (course.maxStudents) {
      const count = await Enrollment.countDocuments({ course: courseId, status: { $ne: 'dropped' } });
      if (count >= course.maxStudents) {
        return res.status(400).json({ success: false, message: 'Course limit reached, enrollment full' });
      }
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      user: userId,
      ...(participantId ? { participant: participantId } : {}),
      course: courseId,
      status: 'enrolled',
      source: 'marketplace',
      progressPercent: 0
    });

    // Update course enrollment counts
    await Course.findByIdAndUpdate(courseId, {
      $inc: { 'statistics.totalEnrollments': 1, currentEnrollments: 1 }
    });

    // Update user's enrolledCourses list
    await User.findByIdAndUpdate(userId, {
      $addToSet: {
        enrolledCourses: {
          course: courseId,
          enrolledAt: new Date(),
          progress: 0,
          status: 'enrolled'
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course',
      enrollment: {
        _id: enrollment._id,
        student: enrollment.user,
        course: enrollment.course,
        status: enrollment.status,
        progress: enrollment.progressPercent,
        enrolledAt: enrollment.enrolledAt
      }
    });

  } catch (error) {
    console.error('enrollInCourse error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
