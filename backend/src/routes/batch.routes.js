import express from 'express';
import {
  createBatch,
  getBatches,
  getBatch,
  updateBatch,
  deleteBatch,
  getAssignableStudents,
  getBatchStudents,
  assignStudentsToBatch,
  removeStudentsFromBatch
} from '../controllers/batch.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/rbac.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Public routes (all authenticated users can view)
router.get('/', getBatches);
router.get('/:id', getBatch);

// Admin-only routes
router.post('/', authorize('administrator'), createBatch);
router.put('/:id', authorize('administrator'), updateBatch);
router.delete('/:id', authorize('administrator'), deleteBatch);
router.get('/:batchId/assignable-students', authorize('administrator'), getAssignableStudents);
router.post('/:batchId/assign-students', authorize('administrator'), assignStudentsToBatch);
router.get('/:batchId/students', authorize('administrator'), getBatchStudents);
router.delete('/:batchId/students', authorize('administrator'), removeStudentsFromBatch);
router.post('/:id/assign', authorize('administrator'), assignStudentsToBatch);
router.post('/:id/remove', authorize('administrator'), removeStudentsFromBatch);

export default router;
