import Batch from '../models/Batch.model.js';
import Course from '../models/Course.model.js';
import Enrollment from '../models/Enrollment.model.js';
import Participant from '../models/Participant.model.js';
import User from '../models/User.model.js';

const toId = (value) => String(value?._id || value || '');
const uniqueIds = (values = []) => [...new Set((values || []).map(toId).filter(Boolean))];

const buildParticipantEnrollmentOps = ({ participants, courseId, batchId, assignedBy }) =>
  participants.map((participant) => ({
    updateOne: {
      filter: { user: participant._id, course: courseId },
      update: {
        $setOnInsert: {
          user: participant._id,
          participant: participant._id,
          course: courseId,
          batch: batchId,
          source: 'batch',
          assignedBy,
          status: 'enrolled',
          progressPercent: 0,
          enrolledAt: new Date(),
        },
        $set: {
          participant: participant._id,
          batch: batchId,
          source: 'batch',
          assignedBy,
        },
      },
      upsert: true,
    },
  }));

const buildUserEnrollmentOps = ({ users, courseId, batchId, assignedBy }) =>
  users.map((user) => ({
    updateOne: {
      filter: { user: user._id, course: courseId },
      update: {
        $setOnInsert: {
          user: user._id,
          course: courseId,
          batch: batchId,
          source: 'batch',
          assignedBy,
          status: 'enrolled',
          progressPercent: 0,
          enrolledAt: new Date(),
        },
        $set: {
          batch: batchId,
          source: 'batch',
          assignedBy,
        },
      },
      upsert: true,
    },
  }));

const updateParticipantCourseList = async (participantIds, courseIds) => {
  const ids = uniqueIds(participantIds);
  const courses = uniqueIds(courseIds);
  if (!ids.length || !courses.length) return;

  await Participant.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { enrolledCourses: { $each: courses } } }
  );

  const participants = await Participant.find({ _id: { $in: ids } }).select('enrolledCourses').lean();
  await Promise.all(participants.map((participant) =>
    Participant.findByIdAndUpdate(participant._id, {
      totalCoursesEnrolled: Array.isArray(participant.enrolledCourses) ? participant.enrolledCourses.length : 0,
    })
  ));
};

const updateUserCourseList = async (userIds, courseIds) => {
  const ids = uniqueIds(userIds);
  const courses = uniqueIds(courseIds);
  if (!ids.length || !courses.length) return;

  const users = await User.find({ _id: { $in: ids }, role: 'student', isActive: true })
    .select('enrolledCourses')
    .lean();

  await Promise.all(users.map((user) => {
    const existingCourseIds = new Set(
      (user.enrolledCourses || []).map((entry) => toId(entry.course || entry))
    );
    const nextEntries = courses
      .filter((courseId) => !existingCourseIds.has(courseId))
      .map((courseId) => ({
        course: courseId,
        enrolledAt: new Date(),
        progress: 0,
        status: 'enrolled',
      }));

    if (!nextEntries.length) return Promise.resolve();
    return User.findByIdAndUpdate(user._id, {
      $push: { enrolledCourses: { $each: nextEntries } },
    });
  }));
};

const incrementCourseEnrollmentCount = async (courseId, count) => {
  if (!count) return;
  await Course.findByIdAndUpdate(courseId, {
    $inc: { currentEnrollments: count, 'statistics.totalEnrollments': count },
  });
};

export const syncCourseBatches = async ({ courseId, newBatchIds = [], oldBatchIds = [] }) => {
  const nextIds = uniqueIds(newBatchIds);
  const prevIds = uniqueIds(oldBatchIds);
  const added = nextIds.filter((id) => !prevIds.includes(id));
  const removed = prevIds.filter((id) => !nextIds.includes(id));

  if (added.length) {
    await Batch.updateMany({ _id: { $in: added } }, { $addToSet: { courses: courseId } });
  }

  if (removed.length) {
    await Batch.updateMany({ _id: { $in: removed } }, { $pull: { courses: courseId } });
  }

  await Course.findByIdAndUpdate(courseId, { $set: { batches: nextIds } });
  return { added, removed, finalBatchIds: nextIds };
};

export const enrollBatchParticipantsInCourse = async ({ batchId, courseId, assignedBy }) => {
  const [participants, users] = await Promise.all([
    Participant.find({ batch: batchId, isActive: true }).select('_id').lean(),
    User.find({ role: 'student', batch: batchId, isActive: true }).select('_id').lean(),
  ]);
  const studentsFound = participants.length + users.length;
  if (!studentsFound) {
    return { studentsFound: 0, enrollmentsCreated: 0, duplicatesSkipped: 0 };
  }

  const ops = [
    ...buildParticipantEnrollmentOps({ participants, courseId, batchId, assignedBy }),
    ...buildUserEnrollmentOps({ users, courseId, batchId, assignedBy }),
  ];
  const result = await Enrollment.bulkWrite(ops, { ordered: false });
  const enrollmentsCreated = result.upsertedCount || 0;
  await Promise.all([
    updateParticipantCourseList(participants.map((p) => p._id), [courseId]),
    updateUserCourseList(users.map((u) => u._id), [courseId]),
  ]);
  await incrementCourseEnrollmentCount(courseId, enrollmentsCreated);

  return {
    studentsFound,
    enrollmentsCreated,
    duplicatesSkipped: studentsFound - enrollmentsCreated,
  };
};

export const enrollParticipantInBatchCourses = async ({ participantIds = [], userIds = [], batchId, assignedBy }) => {
  const participantIdList = uniqueIds(participantIds);
  const userIdList = uniqueIds(userIds);
  const batch = await Batch.findById(batchId).select('courses').lean();
  const courseIds = uniqueIds(batch?.courses || []);
  const assignedCount = participantIdList.length + userIdList.length;

  if (!assignedCount || !courseIds.length) {
    return {
      participantsAssigned: participantIdList.length,
      usersAssigned: userIdList.length,
      coursesFound: courseIds.length,
      enrollmentsCreated: 0,
      duplicatesSkipped: 0,
    };
  }

  const [participants, users] = await Promise.all([
    Participant.find({ _id: { $in: participantIdList }, isActive: true }).select('_id').lean(),
    User.find({ _id: { $in: userIdList }, role: 'student', isActive: true }).select('_id').lean(),
  ]);
  const ops = courseIds.flatMap((courseId) =>
    [
      ...buildParticipantEnrollmentOps({ participants, courseId, batchId, assignedBy }),
      ...buildUserEnrollmentOps({ users, courseId, batchId, assignedBy }),
    ]
  );
  const result = ops.length ? await Enrollment.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0, upsertedIds: {} };
  const enrollmentsCreated = result.upsertedCount || 0;

  await Promise.all([
    updateParticipantCourseList(participants.map((p) => p._id), courseIds),
    updateUserCourseList(users.map((u) => u._id), courseIds),
  ]);

  const createdByCourse = new Map();
  for (const index of Object.keys(result.upsertedIds || {})) {
    const courseId = toId(ops[Number(index)]?.updateOne?.filter?.course);
    if (courseId) createdByCourse.set(courseId, (createdByCourse.get(courseId) || 0) + 1);
  }
  await Promise.all([...createdByCourse.entries()].map(([courseId, count]) => incrementCourseEnrollmentCount(courseId, count)));

  return {
    participantsAssigned: participants.length,
    usersAssigned: users.length,
    coursesFound: courseIds.length,
    enrollmentsCreated,
    duplicatesSkipped: Math.max(0, ops.length - enrollmentsCreated),
  };
};

export const updateBatchStudentCount = async (batchId) => {
  const [participantCount, userCount] = await Promise.all([
    Participant.countDocuments({ batch: batchId, isActive: true }),
    User.countDocuments({ role: 'student', batch: batchId, isActive: true }),
  ]);
  const currentStudents = participantCount + userCount;
  await Batch.findByIdAndUpdate(batchId, { currentStudents });
  return currentStudents;
};

export default {
  syncCourseBatches,
  enrollBatchParticipantsInCourse,
  enrollParticipantInBatchCourses,
  updateBatchStudentCount,
};
