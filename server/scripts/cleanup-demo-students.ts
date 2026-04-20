#!/usr/bin/env tsx

import { and, eq, inArray, or } from "drizzle-orm";
import db from "../src/storage.js";
import {
  attendanceRecords,
  computerAssignments,
  enrollments,
  students,
} from "../src/schema.js";
import { isProductionLike } from "../src/config/env.js";

const DEMO_STUDENTS = [
  { studentId: "20230001", name: "John Doe" },
  { studentId: "20230002", name: "Jane Smith" },
  { studentId: "20230003", name: "Michael Johnson" },
];

const shouldDelete = process.env.CLEANUP_CONFIRMATION === "DELETE_DEMO_STUDENTS";

async function cleanupDemoStudents() {
  const filters = DEMO_STUDENTS.map((student) =>
    and(
      eq(students.studentId, student.studentId),
      eq(students.name, student.name),
    ),
  );

  const demoStudents = await db
    .select({
      id: students.id,
      studentId: students.studentId,
      name: students.name,
    })
    .from(students)
    .where(or(...filters));

  if (demoStudents.length === 0) {
    console.log("No seeded demo students found.");
    return;
  }

  console.log("Found seeded demo students:");
  for (const student of demoStudents) {
    console.log(`- ${student.studentId} | ${student.name}`);
  }

  if (!shouldDelete) {
    console.log("");
    console.log(
      "Dry run only. Re-run with CLEANUP_CONFIRMATION=DELETE_DEMO_STUDENTS to remove them.",
    );
    return;
  }

  const studentIds = demoStudents.map((student) => student.id);

  await db
    .delete(attendanceRecords)
    .where(inArray(attendanceRecords.studentId, studentIds));
  await db
    .delete(computerAssignments)
    .where(inArray(computerAssignments.studentId, studentIds));
  await db.delete(enrollments).where(inArray(enrollments.studentId, studentIds));
  await db.delete(students).where(inArray(students.id, studentIds));

  console.log("");
  console.log(
    `Deleted ${demoStudents.length} demo student(s) and related attendance/enrollment records.`,
  );
}

cleanupDemoStudents()
  .then(() => {
    if (isProductionLike()) {
      console.log("Cleanup completed in production-like mode.");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to clean up demo students:", error);
    process.exit(1);
  });
