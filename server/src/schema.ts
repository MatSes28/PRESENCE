// Re-export all schema definitions from local shared schema copy
import * as sharedSchema from "./shared-schema";

export const users = sharedSchema.users;
export const students = sharedSchema.students;
export const classrooms = sharedSchema.classrooms;
export const subjects = sharedSchema.subjects;
export const schedules = sharedSchema.schedules;
export const classSessions = sharedSchema.classSessions;
export const attendanceRecords = sharedSchema.attendanceRecords;
export const computers = sharedSchema.computers;
export const computerAssignments = sharedSchema.computerAssignments;
export const iotDevices = sharedSchema.iotDevices;
export const enrollments = sharedSchema.enrollments;
export const emailNotifications = sharedSchema.emailNotifications;
export const subjectSessions = sharedSchema.subjectSessions;
export const sessionAssignments = sharedSchema.sessionAssignments;
export const computerMaintenance = sharedSchema.computerMaintenance;

// Export relations
export const usersRelations = sharedSchema.usersRelations;
export const studentsRelations = sharedSchema.studentsRelations;
export const classroomsRelations = sharedSchema.classroomsRelations;
export const subjectsRelations = sharedSchema.subjectsRelations;
export const schedulesRelations = sharedSchema.schedulesRelations;
export const classSessionsRelations = sharedSchema.classSessionsRelations;
export const attendanceRecordsRelations =
  sharedSchema.attendanceRecordsRelations;
export const computersRelations = sharedSchema.computersRelations;
export const computerAssignmentsRelations =
  sharedSchema.computerAssignmentsRelations;
export const iotDevicesRelations = sharedSchema.iotDevicesRelations;
export const enrollmentsRelations = sharedSchema.enrollmentsRelations;
export const emailNotificationsRelations =
  sharedSchema.emailNotificationsRelations;
export const subjectSessionsRelations = sharedSchema.subjectSessionsRelations;
export const sessionAssignmentsRelations =
  sharedSchema.sessionAssignmentsRelations;
export const computerMaintenanceRelations =
  sharedSchema.computerMaintenanceRelations;

// Export types
export type User = sharedSchema.User;
export type NewUser = sharedSchema.NewUser;
export type Student = sharedSchema.Student;
export type NewStudent = sharedSchema.NewStudent;
export type Classroom = sharedSchema.Classroom;
export type NewClassroom = sharedSchema.NewClassroom;
export type Subject = sharedSchema.Subject;
export type NewSubject = sharedSchema.NewSubject;
export type Schedule = sharedSchema.Schedule;
export type NewSchedule = sharedSchema.NewSchedule;
export type ClassSession = sharedSchema.ClassSession;
export type NewClassSession = sharedSchema.NewClassSession;
export type AttendanceRecord = sharedSchema.AttendanceRecord;
export type NewAttendanceRecord = sharedSchema.NewAttendanceRecord;
export type Computer = sharedSchema.Computer;
export type NewComputer = sharedSchema.NewComputer;
export type ComputerAssignment = sharedSchema.ComputerAssignment;
export type NewComputerAssignment = sharedSchema.NewComputerAssignment;
export type IotDevice = sharedSchema.IotDevice;
export type NewIotDevice = sharedSchema.NewIotDevice;
export type Enrollment = sharedSchema.Enrollment;
export type NewEnrollment = sharedSchema.NewEnrollment;
export type EmailNotification = sharedSchema.EmailNotification;
export type NewEmailNotification = sharedSchema.NewEmailNotification;
export type SubjectSession = sharedSchema.SubjectSession;
export type NewSubjectSession = sharedSchema.NewSubjectSession;
export type SessionAssignment = sharedSchema.SessionAssignment;
export type NewSessionAssignment = sharedSchema.NewSessionAssignment;
export type ComputerMaintenance = sharedSchema.ComputerMaintenance;
export type NewComputerMaintenance = sharedSchema.NewComputerMaintenance;
