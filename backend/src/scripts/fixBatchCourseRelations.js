import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Batch from '../models/Batch.model.js';
import Course from '../models/Course.model.js';
import Participant from '../models/Participant.model.js';
import {
  enrollBatchParticipantsInCourse,
  syncCourseBatches,
  updateBatchStudentCount,
} from '../services/batchCourseSync.service.js';

dotenv.config({ path: 'backend/.env' });
dotenv.config();

const uniqueIds = (values = []) => [...new Set((values || []).map((value) => String(value?._id || value || '')).filter(Boolean))];

const connect = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI_PROD;
  if (!mongoUri) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(mongoUri);
};

const run = async () => {
  await connect();

  const summary = {
    coursesFixed: 0,
    batchesFixed: 0,
    enrollmentsCreated: 0,
    duplicatesSkipped: 0,
  };

  const courses = await Course.find({}).select('_id batches accessType').lean();
  for (const course of courses) {
    const batchIds = uniqueIds(course.batches);
    if (batchIds.length) {
      await Course.findByIdAndUpdate(course._id, {
        $set: {
          batches: batchIds,
          accessType: 'batch_assigned',
          isMarketplaceVisible: false,
          isGlobalVisible: false,
          batchAssigned: true,
          assignmentSource: 'batch',
        },
      });
      await syncCourseBatches({ courseId: course._id, newBatchIds: batchIds, oldBatchIds: [] });
      summary.coursesFixed++;
    } else if (course.accessType !== 'private') {
      await Course.findByIdAndUpdate(course._id, {
        $set: {
          batches: [],
          accessType: 'marketplace',
          isMarketplaceVisible: true,
          isGlobalVisible: true,
          batchAssigned: false,
          assignmentSource: 'marketplace',
        },
      });
      summary.coursesFixed++;
    }
  }

  const batches = await Batch.find({}).select('_id courses').lean();
  for (const batch of batches) {
    const courseIds = uniqueIds(batch.courses);
    await Batch.findByIdAndUpdate(batch._id, { $set: { courses: courseIds } });
    await updateBatchStudentCount(batch._id);
    summary.batchesFixed++;

    for (const courseId of courseIds) {
      await Course.findByIdAndUpdate(courseId, {
        $addToSet: { batches: batch._id },
        $set: {
          accessType: 'batch_assigned',
          isMarketplaceVisible: false,
          isGlobalVisible: false,
          batchAssigned: true,
          assignmentSource: 'batch',
        },
      });
      const result = await enrollBatchParticipantsInCourse({ batchId: batch._id, courseId });
      summary.enrollmentsCreated += result.enrollmentsCreated;
      summary.duplicatesSkipped += result.duplicatesSkipped;
    }
  }

  const orphanBatchCourses = await Course.find({ batches: { $exists: true, $ne: [] } }).select('_id batches').lean();
  for (const course of orphanBatchCourses) {
    for (const batchId of uniqueIds(course.batches)) {
      const exists = await Batch.exists({ _id: batchId, courses: course._id });
      if (!exists) await Batch.findByIdAndUpdate(batchId, { $addToSet: { courses: course._id } });
    }
  }

  const participantCounts = await Participant.aggregate([
    { $match: { isActive: true, batch: { $ne: null } } },
    { $group: { _id: '$batch', count: { $sum: 1 } } },
  ]);
  for (const item of participantCounts) {
    await Batch.findByIdAndUpdate(item._id, { currentStudents: item.count });
  }

  console.log(JSON.stringify(summary, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
