// Production seed script for initial data population
// WARNING: Only run this in a fresh database

import { db } from "../storage.js";
import { students, users, subjects, classrooms, schedules } from "../schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12");

async function seed() {
  console.log("🌱 Starting production seed...");

  try {
    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("⚠️  Data already exists. Skipping seed.");
      console.log("💡 To reseed, clear the database first.");
      return;
    }

    // Create admin user
    const adminPassword = await bcrypt.hash("Admin123!", BCRYPT_ROUNDS);
    await db.insert(users).values({
      email: "admin@clirdec.edu",
      password: adminPassword,
      name: "System Administrator",
      role: "admin",
      facultyId: "ADMIN001",
      department: "Administration",
      isActive: true,
    });
    console.log("✅ Admin user created: admin@clirdec.edu / Admin123!");

    // Create sample faculty
    const facultyPassword = await bcrypt.hash("Faculty123!", BCRYPT_ROUNDS);
    const facultyId = await db
      .insert(users)
      .values({
        email: "faculty@clirdec.edu",
        password: facultyPassword,
        name: "John Faculty",
        role: "faculty",
        facultyId: "FAC001",
        department: "DIT",
        isActive: true,
      })
      .returning()
      .then((r) => r[0].id);
    console.log("✅ Faculty user created: faculty@clirdec.edu / Faculty123!");

    // Create subjects
    const subjectData = [
      {
        code: "IT311",
        name: "Web Development",
        description: "Advanced web technologies and frameworks",
        isActive: true,
      },
      {
        code: "IT312",
        name: "Mobile Application Development",
        description: "iOS and Android development",
        isActive: true,
      },
      {
        code: "IT313",
        name: "Database Management Systems",
        description: "Advanced database design and optimization",
        isActive: true,
      },
      {
        code: "IT314",
        name: "Software Engineering",
        description: "Software development lifecycle and methodologies",
        isActive: true,
      },
      {
        code: "IT315",
        name: "Network Security",
        description: "Network security and cryptography",
        isActive: true,
      },
    ];

    for (const subject of subjectData) {
      await db.insert(subjects).values(subject);
    }
    console.log(`✅ Created ${subjectData.length} subjects`);

    // Create classrooms
    const classroomData = [
      {
        name: "CLIRDEC Room 101",
        location: "CLIRDEC Building",
        type: "lecture",
        capacity: 40,
        isActive: true,
      },
      {
        name: "CLIRDEC Lab 102",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 30,
        isActive: true,
      },
      {
        name: "CLIRDEC Lab 103",
        location: "CLIRDEC Building",
        type: "laboratory",
        capacity: 25,
        isActive: true,
      },
      {
        name: "CLIRDEC Room 104",
        location: "CLIRDEC Building",
        type: "lecture",
        capacity: 50,
        isActive: true,
      },
    ];

    const createdClassrooms = [];
    for (const classroom of classroomData) {
      const result = await db.insert(classrooms).values(classroom).returning();
      createdClassrooms.push(result[0]);
    }
    console.log(`✅ Created ${classroomData.length} classrooms`);

    // Create schedules
    const allSubjects = await db.select().from(subjects);
    const scheduleData = [
      {
        subjectId: allSubjects[0].id,
        classroomId: createdClassrooms[0].id,
        facultyId: facultyId,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "10:30",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: true,
        recurrencePattern: "weekly",
        conflictResolutionPriority: 1,
        allowRoomChange: false,
        allowTimeAdjustment: false,
        isActive: true,
      },
      {
        subjectId: allSubjects[1].id,
        classroomId: createdClassrooms[1].id,
        facultyId: facultyId,
        dayOfWeek: 1,
        startTime: "13:00",
        endTime: "15:30",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: true,
        recurrencePattern: "weekly",
        conflictResolutionPriority: 1,
        allowRoomChange: false,
        allowTimeAdjustment: false,
        isActive: true,
      },
      {
        subjectId: allSubjects[2].id,
        classroomId: createdClassrooms[2].id,
        facultyId: facultyId,
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "11:30",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: true,
        recurrencePattern: "weekly",
        conflictResolutionPriority: 1,
        allowRoomChange: false,
        allowTimeAdjustment: false,
        isActive: true,
      },
      {
        subjectId: allSubjects[3].id,
        classroomId: createdClassrooms[0].id,
        facultyId: facultyId,
        dayOfWeek: 3,
        startTime: "10:00",
        endTime: "12:30",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: true,
        recurrencePattern: "weekly",
        conflictResolutionPriority: 1,
        allowRoomChange: false,
        allowTimeAdjustment: false,
        isActive: true,
      },
      {
        subjectId: allSubjects[4].id,
        classroomId: createdClassrooms[3].id,
        facultyId: facultyId,
        dayOfWeek: 4,
        startTime: "14:00",
        endTime: "16:30",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: true,
        recurrencePattern: "weekly",
        conflictResolutionPriority: 1,
        allowRoomChange: false,
        allowTimeAdjustment: false,
        isActive: true,
      },
    ];

    for (const schedule of scheduleData) {
      await db.insert(schedules).values(schedule);
    }
    console.log(`✅ Created ${scheduleData.length} schedules`);

    // Create sample students
    const studentData = [];
    for (let i = 1; i <= 20; i++) {
      const studentId = `2024-${String(i).padStart(4, "0")}`;
      studentData.push({
        studentId,
        name: `Student ${i}`,
        email: `student${i}@clirdec.edu`,
        year: 3,
        section: "A",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
        parentEmail: `parent${i}@email.com`,
        parentName: `Parent ${i}`,
        rfidUid: `RFID${String(i).padStart(6, "0")}`,
        isActive: true,
      });
    }

    for (const student of studentData) {
      await db.insert(students).values(student);
    }
    console.log(`✅ Created ${studentData.length} students`);

    console.log("\n🎉 Production seed completed successfully!");
    console.log("\n📝 Default credentials:");
    console.log("   Admin: admin@clirdec.edu / Admin123!");
    console.log("   Faculty: faculty@clirdec.edu / Faculty123!");
    console.log(
      "\n⚠️  IMPORTANT: Change these passwords immediately after first login!"
    );
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

// Run if called directly
seed().catch(console.error);
