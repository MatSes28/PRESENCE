#!/usr/bin/env tsx

/**
 * Test data seed script for local development
 * Creates sample data for testing and development purposes
 */

import db from "../src/storage.js";
import {
  students,
  users,
  subjects,
  classrooms,
  schedules,
  classSessions,
  attendanceRecords,
  computers,
  enrollments,
} from "../src/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

async function seedTestData() {
  console.log("🌱 Seeding test data for local development...\n");

  try {
    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("⚠️  Data already exists. Skipping seed.");
      console.log("💡 To reseed, clear the database first.");
      return;
    }

    console.log("📋 Creating test data...");

    // Create admin user
    const adminPassword = await bcrypt.hash("Admin123!", BCRYPT_ROUNDS);
    const [admin] = await db
      .insert(users)
      .values({
        email: "admin@clirdec.edu",
        password: adminPassword,
        name: "Admin User",
        role: "admin",
        facultyId: "ADMIN001",
        department: "Information Technology",
        gender: "male",
        isActive: true,
      })
      .returning();

    console.log(`✅ Created admin user: ${admin.email}`);

    // Create faculty user
    const facultyPassword = await bcrypt.hash("Faculty123!", BCRYPT_ROUNDS);
    const [faculty] = await db
      .insert(users)
      .values({
        email: "faculty@clirdec.edu",
        password: facultyPassword,
        name: "Faculty Member",
        role: "faculty",
        facultyId: "FAC001",
        department: "Information Technology",
        gender: "female",
        isActive: true,
      })
      .returning();

    console.log(`✅ Created faculty user: ${faculty.email}`);

    // Create classrooms
    const classroomData = [
      {
        name: "CLIRDEC Lab 1",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 30,
        isActive: true,
      },
      {
        name: "CLIRDEC Lab 2",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 30,
        isActive: true,
      },
      {
        name: "CLIRDEC Lab 3",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 30,
        isActive: true,
      },
      {
        name: "CLIRDEC Lab 4",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 30,
        isActive: true,
      },
    ];

    const createdClassrooms = [];
    for (const classroom of classroomData) {
      const result = await db.insert(classrooms).values(classroom).returning();
      createdClassrooms.push(result[0]);
      console.log(`✅ Created classroom: ${classroom.name}`);
    }

    // Create subjects
    const subjectData = [
      {
        code: "IT101",
        name: "Introduction to Computing",
        description: "Basic computing concepts",
        isActive: true,
      },
      {
        code: "IT102",
        name: "Programming Fundamentals",
        description: "Introduction to programming",
        isActive: true,
      },
      {
        code: "IT201",
        name: "Database Management Systems",
        description: "Advanced database design and optimization",
        isActive: true,
      },
      {
        code: "IT202",
        name: "Web Development",
        description: "Web technologies and frameworks",
        isActive: true,
      },
      {
        code: "IT301",
        name: "Software Engineering",
        description: "Software development methodologies",
        isActive: true,
      },
    ];

    for (const subject of subjectData) {
      await db.insert(subjects).values(subject);
      console.log(`✅ Created subject: ${subject.code} - ${subject.name}`);
    }

    // Create schedules
    const allSubjects = await db.select().from(subjects);
    const scheduleData = [
      {
        subjectId: allSubjects[0].id,
        classroomId: createdClassrooms[0].id,
        facultyId: faculty.id,
        dayOfWeek: 1, // Monday
        startTime: "08:00",
        endTime: "10:00",
        semester: "1st Semester",
        academicYear: "2023-2024",
        isRecurring: true,
        recurrencePattern: "weekly",
        isActive: true,
      },
      {
        subjectId: allSubjects[1].id,
        classroomId: createdClassrooms[1].id,
        facultyId: faculty.id,
        dayOfWeek: 2, // Tuesday
        startTime: "10:00",
        endTime: "12:00",
        semester: "1st Semester",
        academicYear: "2023-2024",
        isRecurring: true,
        recurrencePattern: "weekly",
        isActive: true,
      },
    ];

    for (const schedule of scheduleData) {
      await db.insert(schedules).values(schedule);
      console.log(
        `✅ Created schedule for subject ${schedule.subjectId} in classroom ${schedule.classroomId}`
      );
    }

    // Create computers for each classroom
    for (const classroom of createdClassrooms) {
      for (let i = 1; i <= 10; i++) {
        await db.insert(computers).values({
          classroomId: classroom.id,
          name: `${classroom.name} - Computer ${i}`,
          ipAddress: `192.168.1.${i}`,
          macAddress: `00:1A:2B:3C:4D:${i.toString().padStart(2, "0")}`,
          status: "available",
          isActive: true,
        });
      }
      console.log(`✅ Created 10 computers for ${classroom.name}`);
    }

    // Create students
    const studentData = [
      {
        studentId: "20230001",
        name: "John Doe",
        email: "john.doe@student.clirdec.edu",
        year: 1,
        section: "A",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
        rfidUid: "1234567890",
        parentEmail: "john.parent@email.com",
        parentName: "Jane Doe",
        isActive: true,
      },
      {
        studentId: "20230002",
        name: "Jane Smith",
        email: "jane.smith@student.clirdec.edu",
        year: 1,
        section: "A",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
        rfidUid: "2345678901",
        parentEmail: "jane.parent@email.com",
        parentName: "Robert Smith",
        isActive: true,
      },
      {
        studentId: "20230003",
        name: "Michael Johnson",
        email: "michael.johnson@student.clirdec.edu",
        year: 2,
        section: "B",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
        rfidUid: "3456789012",
        parentEmail: "michael.parent@email.com",
        parentName: "Sarah Johnson",
        isActive: true,
      },
    ];

    const createdStudents = [];
    for (const student of studentData) {
      const result = await db.insert(students).values(student).returning();
      createdStudents.push(result[0]);
      console.log(`✅ Created student: ${student.name} (${student.studentId})`);
    }

    // Create enrollments
    const allStudents = await db.select().from(students);
    for (const student of allStudents) {
      for (const subject of allSubjects) {
        await db.insert(enrollments).values({
          studentId: student.id,
          subjectId: subject.id,
          semester: "1st Semester",
          academicYear: "2023-2024",
          enrolledAt: new Date(),
          isActive: true,
        });
      }
      console.log(`✅ Enrolled student ${student.studentId} in all subjects`);
    }

    // Create class sessions for today
    const today = new Date();
    const allSchedules = await db.select().from(schedules);

    for (const schedule of allSchedules) {
      const sessionDate = new Date(today);
      sessionDate.setHours(8, 0, 0, 0); // Set to 8 AM

      const [session] = await db
        .insert(classSessions)
        .values({
          scheduleId: schedule.id,
          date: sessionDate,
          status: "scheduled",
          isActive: true,
        })
        .returning();

      console.log(`✅ Created class session for schedule ${schedule.id}`);

      // Create attendance records for this session
      for (const student of createdStudents) {
        await db.insert(attendanceRecords).values({
          studentId: student.id,
          classSessionId: session.id,
          entryTime: new Date(
            sessionDate.getTime() + Math.floor(Math.random() * 3600000)
          ), // Random time within 1 hour
          exitTime: new Date(
            sessionDate.getTime() +
              3600000 +
              Math.floor(Math.random() * 3600000)
          ), // Random time within next hour
          status: "present",
          rfidDetected: true,
          sensorDetected: true,
          isValid: true,
          discrepancyFlag: false,
          isActive: true,
        });
        console.log(
          `✅ Created attendance record for student ${student.studentId}`
        );
      }
    }

    console.log("\n🎉 Test data seeding completed successfully!");
    console.log("📊 Summary:");
    console.log(`   - Users: 2 (1 admin, 1 faculty)`);
    console.log(`   - Classrooms: ${createdClassrooms.length}`);
    console.log(`   - Subjects: ${subjectData.length}`);
    console.log(`   - Schedules: ${scheduleData.length}`);
    console.log(`   - Computers: ${createdClassrooms.length * 10}`);
    console.log(`   - Students: ${studentData.length}`);
    console.log(`   - Enrollments: ${allStudents.length * allSubjects.length}`);
    console.log(`   - Class Sessions: ${allSchedules.length}`);
    console.log(
      `   - Attendance Records: ${createdStudents.length * allSchedules.length}`
    );
  } catch (error) {
    console.error("❌ Error seeding test data:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData();
}

export { seedTestData };
