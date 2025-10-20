import { Router } from 'express'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import attendanceRoutes from './routes/attendance.js'
import classroomRoutes from './routes/classrooms.js'
import scheduleRoutes from './routes/schedules.js'
import reportRoutes from './routes/reports.js'
import iotRoutes from './routes/iot.js'

const router = Router()

// Mount route modules
router.use('/auth', authRoutes)
router.use('/students', studentRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/classrooms', classroomRoutes)
router.use('/schedules', scheduleRoutes)
router.use('/reports', reportRoutes)
router.use('/iot', iotRoutes)

export default router