import { Router } from "express";
import db from "../storage.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {
  attendanceRecords,
  classSessions,
  classrooms,
  students,
  schedules,
  subjects,
  enrollments,
  reportHistory,
  reportPresets,
  reportSchedules,
  users,
} from "../schema.js";
import { eq, and, gte, lte, lt, desc, sql, inArray, like, or } from "drizzle-orm";
import { reportSchedulerService } from "../services/reportScheduler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";

const router = Router();

type ReportFilter = {
  label: string;
  value: string;
};

type ReportMetadata = {
  generatedAt: Date;
  filters: ReportFilter[];
  summary: ReportFilter[];
};

type ReportType = "attendance" | "students" | "classroom";

type ReportQueryParams = {
  type: ReportType;
  startDate?: string;
  endDate?: string;
  subjectId?: string | number;
  classroomId?: string | number;
  facultyId?: string | number;
  isFaculty: boolean;
  facultyUserId: number;
};

const defaultReportPresets = [
  {
    id: "default-daily-attendance",
    name: "Daily Attendance Summary",
    visibility: "shared",
    isDefault: true,
    parameters: {
      type: "attendance",
      format: "xlsx",
      datePreset: "today",
      columns: [
        "Student Name",
        "Student ID",
        "Subject",
        "Status",
        "Entry Time",
        "Recorded At",
      ],
    },
  },
  {
    id: "default-weekly-late",
    name: "Weekly Late Students",
    visibility: "shared",
    isDefault: true,
    parameters: {
      type: "attendance",
      format: "csv",
      datePreset: "week",
      columns: ["Student Name", "Student ID", "Subject", "Status", "Entry Time"],
    },
  },
  {
    id: "default-monthly-classroom",
    name: "Monthly Classroom Utilization",
    visibility: "shared",
    isDefault: true,
    parameters: {
      type: "classroom",
      format: "pdf",
      datePreset: "month",
      columns: [
        "Session ID",
        "Date",
        "Status",
        "Subject",
        "Class Section",
        "Attendance Records",
        "Presence Rate",
      ],
    },
  },
  {
    id: "default-student-enrollment",
    name: "Student Enrollment Export",
    visibility: "shared",
    isDefault: true,
    parameters: {
      type: "students",
      format: "csv",
      datePreset: "custom",
      columns: [
        "Student Name",
        "Student ID",
        "Email",
        "Program",
        "Year",
        "Section",
        "Active Enrollments",
        "Status",
      ],
    },
  },
];

const parseOptionalId = (value?: string | number) => {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toPrintableValue = (value: any): string => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.values(value)
      .filter((entry) => entry != null && entry !== "")
      .map((entry) => toPrintableValue(entry))
      .join(" - ");
  }
  return String(value);
};

const flattenReportRow = (row: Record<string, any>, prefix = "") => {
  return Object.entries(row).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const nextKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === "object" && !(value instanceof Date)) {
        Object.assign(
          acc,
          flattenReportRow(value as Record<string, any>, nextKey),
        );
      } else {
        acc[nextKey] = toPrintableValue(value);
      }

      return acc;
    },
    {},
  );
};

const flattenReportRows = (rows: any[]) =>
  rows.map((row) => flattenReportRow(row));

const formatReportDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const formatReportDateTime = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatFileDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split("T")[0];
};

const slugifyFilePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "all";

const toTitle = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildReportFilename = (
  type: string,
  subjectLabel: string,
  classroomLabel: string,
  startDate?: string,
  endDate?: string,
) => {
  const datePart =
    startDate && endDate
      ? `${formatFileDate(startDate)}-to-${formatFileDate(endDate)}`
      : startDate
        ? `from-${formatFileDate(startDate)}`
        : endDate
          ? `through-${formatFileDate(endDate)}`
          : `generated-${formatFileDate(new Date())}`;

  return [
    `${slugifyFilePart(type)}-report`,
    slugifyFilePart(subjectLabel),
    slugifyFilePart(classroomLabel),
    datePart,
  ].join("_");
};

const csvEscape = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const toIsoString = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
};

const buildStrictCsv = (headers: string[], rows: Record<string, any>[]) =>
  [
    headers.map((header) => csvEscape(header)).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ].join("\n");

const columnName = (index: number) => {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
};

const buildExcelBuffer = async (
  title: string,
  headers: string[],
  rows: Record<string, any>[],
  metadata: ReportMetadata,
) => {
  const thinSlateBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
  const tableBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CLIRDEC:PRESENCE";
  workbook.created = metadata.generatedAt;
  workbook.modified = metadata.generatedAt;

  const worksheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 9 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  const lastColumn = columnName(Math.max(headers.length, 1));
  worksheet.mergeCells(`A1:${lastColumn}1`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 22,
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.getCell("A2").value =
    "CLIRDEC:PRESENCE | College of Engineering | Confidential Academic Record";
  worksheet.getCell("A2").font = {
    bold: true,
    color: { argb: "FF0891B2" },
    size: 11,
  };
  worksheet.getCell("A2").alignment = { horizontal: "center" };

  const filters = [
    { label: "Generated", value: formatReportDateTime(metadata.generatedAt) },
    ...metadata.filters,
  ];

  filters.forEach((filter, index) => {
    const row = 4 + Math.floor(index / 2);
    const col =
      index % 2 === 0
        ? 1
        : Math.min(
            Math.max(3, Math.ceil(headers.length / 2) + 1),
            Math.max(3, headers.length - 1),
          );
    worksheet.getCell(row, col).value = filter.label;
    worksheet.getCell(row, col).font = {
      bold: true,
      color: { argb: "FF475569" },
    };
    worksheet.getCell(row, col).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    worksheet.getCell(row, col).border = thinSlateBorder;
    worksheet.getCell(row, col).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell(row, col + 1).value = filter.value;
    worksheet.getCell(row, col + 1).font = { color: { argb: "FF0F172A" } };
    worksheet.getCell(row, col + 1).border = thinSlateBorder;
    worksheet.getCell(row, col + 1).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
  });

  const summaryStartRow = 7;
  metadata.summary.slice(0, 4).forEach((item, index) => {
    const startCol = 1 + index * 2;
    if (startCol > headers.length) return;
    worksheet.mergeCells(summaryStartRow, startCol, summaryStartRow, startCol + 1);
    const labelCell = worksheet.getCell(summaryStartRow, startCol);
    labelCell.value = `${item.label.toUpperCase()}: ${item.value}`;
    labelCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF155E75" },
    };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.border = {
      top: { style: "medium", color: { argb: "FF0E7490" } },
      bottom: { style: "medium", color: { argb: "FF0E7490" } },
      left: { style: "medium", color: { argb: "FF0E7490" } },
      right: { style: "medium", color: { argb: "FF0E7490" } },
    };
  });

  const headerRowNumber = 9;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinSlateBorder;
  });

  rows.forEach((row, index) => {
    const worksheetRow = worksheet.addRow(headers.map((header) => row[header] ?? ""));
    worksheetRow.height = 22;
    worksheetRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const normalized = String(cell.value ?? "").toLowerCase();
      const statusColor =
        header === "record_status" && normalized === "present"
          ? "FFD1FAE5"
          : header === "record_status" && normalized === "late"
            ? "FFFEF3C7"
            : header === "record_status" && normalized === "absent"
              ? "FFFEE2E2"
              : index % 2 === 0
                ? "FFFFFFFF"
                : "FFF8FAFC";

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: statusColor },
      };
      cell.font = { color: { argb: "FF0F172A" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: typeof cell.value === "number" ? "center" : "left",
        wrapText: true,
      };
      cell.border = tableBorder;
    });
  });

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: headers.length },
  };

  worksheet.columns = headers.map((header) => {
    const maxContentLength = rows.reduce(
      (max, row) => Math.max(max, String(row[header] ?? "").length),
      header.length,
    );
    return {
      key: header,
      width: Math.min(Math.max(maxContentLength + 4, 14), 34),
    };
  });

  worksheet.eachRow((row) => {
    row.commit();
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
};

const buildCsvRows = (type: string, data: any[]) => {
  switch (type) {
    case "attendance":
      return {
        headers: [
          "record_id",
          "record_createdAt",
          "record_status",
          "record_notes",
          "student_id",
          "student_name",
          "student_studentId",
          "session_id",
          "session_subjectName",
        ],
        rows: data.map((row) => ({
          record_id: row.record?.id,
          record_createdAt: toIsoString(row.record?.createdAt),
          record_status: row.record?.status || "",
          record_notes: row.record?.notes || "",
          student_id: row.student?.id,
          student_name: row.student?.name || "",
          student_studentId: row.student?.studentId || "",
          session_id: row.session?.id,
          session_subjectName: row.session?.subjectName || "",
        })),
      };
    case "students":
      return {
        headers: [
          "student_id",
          "student_name",
          "student_studentId",
          "enrollmentCount",
        ],
        rows: data.map((row) => ({
          student_id: row.student?.id,
          student_name: row.student?.name || "",
          student_studentId: row.student?.studentId || "",
          enrollmentCount: row.enrollmentCount ?? 0,
        })),
      };
    case "classroom":
      return {
        headers: [
          "session_id",
          "session_createdAt",
          "schedule_id",
          "schedule_subjectId",
          "schedule_classroomId",
          "attendanceCount",
          "presentCount",
        ],
        rows: data.map((row) => ({
          session_id: row.session?.id,
          session_createdAt: toIsoString(
            row.session?.createdAt || row.session?.date,
          ),
          schedule_id: row.schedule?.id,
          schedule_subjectId: row.schedule?.subjectId,
          schedule_classroomId: row.schedule?.classroomId,
          attendanceCount: row.attendanceCount ?? 0,
          presentCount: row.presentCount ?? 0,
        })),
      };
    default:
      return {
        headers: data.length > 0 ? Object.keys(flattenReportRow(data[0])) : [],
        rows: flattenReportRows(data),
      };
  }
};

const buildDisplayRows = (type: string, data: any[]) => {
  switch (type) {
    case "attendance":
      return data.map((row) => ({
        "Student Name": toPrintableValue(row.student?.name),
        "Student ID": toPrintableValue(row.student?.studentId),
        Subject: toPrintableValue(row.session?.subjectName),
        Status: toTitle(toPrintableValue(row.record?.status || "Unmarked")),
        "Entry Time": formatReportDateTime(row.record?.entryTime),
        "Exit Time": formatReportDateTime(row.record?.exitTime),
        "RFID Verified": row.record?.rfidDetected ? "Yes" : "No",
        "Sensor Verified": row.record?.sensorDetected ? "Yes" : "No",
        "Recorded At": formatReportDateTime(row.record?.createdAt),
        Notes: toPrintableValue(row.record?.notes),
      }));
    case "students":
      return data.map((row) => ({
        "Student Name": toPrintableValue(row.student?.name),
        "Student ID": toPrintableValue(row.student?.studentId),
        Email: toPrintableValue(row.student?.email),
        Program: toPrintableValue(row.student?.program),
        Year: toPrintableValue(row.student?.year),
        Section: toPrintableValue(row.student?.section),
        "Active Enrollments": toPrintableValue(row.enrollmentCount),
        Status: row.student?.isActive ? "Active" : "Inactive",
      }));
    case "classroom":
      return data.map((row) => {
        const attendanceCount = Number(row.attendanceCount || 0);
        const presentCount = Number(row.presentCount || 0);
        const rate =
          attendanceCount > 0
            ? `${Math.round((presentCount / attendanceCount) * 100)}%`
            : "0%";

        return {
          "Session ID": toPrintableValue(row.session?.id),
          Date: formatReportDate(row.session?.date || row.session?.createdAt),
          Status: toTitle(toPrintableValue(row.session?.status || "Scheduled")),
          Subject: row.subject?.code
            ? `${row.subject.code} - ${row.subject.name}`
            : "",
          "Class Section": row.classroom?.location
            ? `${row.classroom.name} - ${row.classroom.location}`
            : toPrintableValue(row.classroom?.name),
          "Attendance Records": toPrintableValue(attendanceCount),
          Present: toPrintableValue(presentCount),
          "Presence Rate": rate,
        };
      });
    default:
      return flattenReportRows(data);
  }
};

const buildSummary = (type: string, rows: Record<string, string>[]) => {
  if (type === "attendance") {
    const countStatus = (status: string) =>
      rows.filter((row) => row.Status?.toLowerCase() === status).length;

    return [
      { label: "Records", value: rows.length.toLocaleString() },
      { label: "Present", value: countStatus("present").toLocaleString() },
      { label: "Late", value: countStatus("late").toLocaleString() },
      { label: "Absent", value: countStatus("absent").toLocaleString() },
    ];
  }

  if (type === "students") {
    const active = rows.filter((row) => row.Status === "Active").length;
    return [
      { label: "Students", value: rows.length.toLocaleString() },
      { label: "Active", value: active.toLocaleString() },
      { label: "Inactive", value: (rows.length - active).toLocaleString() },
      {
        label: "Enrollments",
        value: rows
          .reduce(
            (sum, row) => sum + Number(row["Active Enrollments"] || 0),
            0,
          )
          .toLocaleString(),
      },
    ];
  }

  if (type === "classroom") {
    const attendanceRecords = rows.reduce(
      (sum, row) => sum + Number(row["Attendance Records"] || 0),
      0,
    );
    const presentRecords = rows.reduce(
      (sum, row) => sum + Number(row.Present || 0),
      0,
    );
    const rate =
      attendanceRecords > 0
        ? `${((presentRecords / attendanceRecords) * 100).toFixed(1)}%`
        : "0%";

    return [
      { label: "Sessions", value: rows.length.toLocaleString() },
      { label: "Attendance Records", value: attendanceRecords.toLocaleString() },
      { label: "Present", value: presentRecords.toLocaleString() },
      { label: "Presence Rate", value: rate },
    ];
  }

  return [{ label: "Rows", value: rows.length.toLocaleString() }];
};

const filterReportColumns = (
  headers: string[],
  rows: Record<string, any>[],
  requestedColumns?: unknown,
) => {
  if (!Array.isArray(requestedColumns) || requestedColumns.length === 0) {
    return { headers, rows };
  }

  const selected = requestedColumns
    .map((column) => String(column))
    .filter((column) => headers.includes(column));

  if (selected.length === 0) {
    return { headers, rows };
  }

  return {
    headers: selected,
    rows: rows.map((row) =>
      selected.reduce<Record<string, any>>((acc, header) => {
        acc[header] = row[header];
        return acc;
      }, {}),
    ),
  };
};

const dateRangeIsInvalid = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getTime() > end.getTime()
  );
};

const allowedScheduleFrequencies = ["daily", "weekly", "monthly"] as const;
const allowedReportFormats = ["csv", "xlsx", "pdf"] as const;

type ScheduleFrequency = (typeof allowedScheduleFrequencies)[number];

const isScheduleFrequency = (value: unknown): value is ScheduleFrequency =>
  typeof value === "string" &&
  allowedScheduleFrequencies.includes(value as ScheduleFrequency);

const isReportFormat = (value: unknown): value is ReportArtifact["format"] =>
  typeof value === "string" &&
  allowedReportFormats.includes(value as ReportArtifact["format"]);

const isValidTimeOfDay = (value: unknown) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isValidEmail = (value: unknown) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const clampMonthlyDay = (day: number, year: number, monthIndex: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
};

const calculateNextReportRun = (
  frequency: ScheduleFrequency,
  timeOfDay: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
) => {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (frequency === "daily") {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (frequency === "weekly") {
    const targetDay = Number.isInteger(dayOfWeek) ? Number(dayOfWeek) : 1;
    const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + daysUntilTarget);
    if (next <= now) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  const targetDate = Number.isInteger(dayOfMonth) ? Number(dayOfMonth) : 1;
  const currentMonthDay = clampMonthlyDay(
    targetDate,
    now.getFullYear(),
    now.getMonth(),
  );
  next.setDate(currentMonthDay);
  if (next <= now) {
    next.setMonth(next.getMonth() + 1, 1);
    next.setDate(
      clampMonthlyDay(targetDate, next.getFullYear(), next.getMonth()),
    );
  }
  return next;
};

type ReportArtifact = {
  body: Buffer | string;
  contentType: string;
  filename: string;
  format: "csv" | "xlsx" | "pdf";
};

const normalizeReportFormat = (format: unknown): ReportArtifact["format"] => {
  if (format === "xlsx" || format === "excel") return "xlsx";
  if (format === "pdf") return "pdf";
  return "csv";
};

const buildReportArtifact = async ({
  type,
  format,
  data,
  columns,
  filteredDisplay,
  reportTitle,
  metadata,
  filenameBase,
}: {
  type: string;
  format: unknown;
  data: any[];
  columns?: unknown;
  filteredDisplay: {
    headers: string[];
    rows: Record<string, any>[];
  };
  reportTitle: string;
  metadata: ReportMetadata;
  filenameBase: string;
}): Promise<ReportArtifact> => {
  const normalizedFormat = normalizeReportFormat(format);
  const hasCustomColumns = Array.isArray(columns);

  if (normalizedFormat === "csv") {
    const csvData = hasCustomColumns ? filteredDisplay : buildCsvRows(type, data);
    const { headers, rows } = filterReportColumns(
      csvData.headers,
      csvData.rows,
      hasCustomColumns ? columns : undefined,
    );

    return {
      body: buildStrictCsv(headers, rows),
      contentType: "text/csv",
      filename: `${filenameBase}.csv`,
      format: "csv",
    };
  }

  if (normalizedFormat === "xlsx") {
    const excelData = hasCustomColumns ? filteredDisplay : buildCsvRows(type, data);
    const { headers, rows } = filterReportColumns(
      excelData.headers,
      excelData.rows,
      hasCustomColumns ? columns : undefined,
    );

    return {
      body: await buildExcelBuffer(reportTitle, headers, rows, metadata),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${filenameBase}.xlsx`,
      format: "xlsx",
    };
  }

  return {
    body: await buildPdfBuffer(reportTitle, filteredDisplay.rows, metadata),
    contentType: "application/pdf",
    filename: `${filenameBase}.pdf`,
    format: "pdf",
  };
};

const loadReportRows = async ({
  type,
  startDate,
  endDate,
  subjectId,
  classroomId,
  facultyId,
  isFaculty,
  facultyUserId,
}: ReportQueryParams) => {
  const selectedSubjectId = parseOptionalId(subjectId);
  const selectedClassroomId = parseOptionalId(classroomId);
  const selectedFacultyId = parseOptionalId(facultyId);
  const scopedFacultyId = isFaculty ? facultyUserId : selectedFacultyId;

  switch (type) {
    case "attendance": {
      let query = db
        .select({
          record: attendanceRecords,
          student: {
            id: students.id,
            name: students.name,
            studentId: students.studentId,
          },
          session: {
            id: classSessions.id,
            date: classSessions.date,
            subjectName: subjects.name,
          },
        })
        .from(attendanceRecords)
        .leftJoin(students, eq(attendanceRecords.studentId, students.id))
        .leftJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .leftJoin(subjects, eq(schedules.subjectId, subjects.id));

      const conditions = [];
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(attendanceRecords.createdAt, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(attendanceRecords.createdAt, end));
      }
      if (selectedSubjectId) {
        conditions.push(eq(schedules.subjectId, selectedSubjectId));
      }
      if (selectedClassroomId) {
        conditions.push(eq(schedules.classroomId, selectedClassroomId));
      }
      if (scopedFacultyId) {
        conditions.push(eq(schedules.facultyId, scopedFacultyId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return query.orderBy(desc(attendanceRecords.createdAt));
    }

    case "students": {
      let query = db
        .select({
          student: students,
          enrollmentCount: sql<number>`count(${enrollments.id})`,
        })
        .from(students)
        .leftJoin(enrollments, eq(students.id, enrollments.studentId));

      const conditions = [];
      if (selectedSubjectId) {
        conditions.push(eq(enrollments.subjectId, selectedSubjectId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return query.groupBy(students.id).orderBy(students.name);
    }

    case "classroom": {
      let query = db
        .select({
          session: classSessions,
          schedule: {
            id: schedules.id,
            subjectId: schedules.subjectId,
            classroomId: schedules.classroomId,
          },
          subject: {
            code: subjects.code,
            name: subjects.name,
          },
          classroom: {
            name: classrooms.name,
            location: classrooms.location,
          },
          attendanceCount: sql<number>`count(${attendanceRecords.id})`,
          presentCount: sql<number>`count(case when ${attendanceRecords.status} = 'present' then 1 end)`,
        })
        .from(classSessions)
        .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
        .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
        .leftJoin(
          attendanceRecords,
          eq(classSessions.id, attendanceRecords.classSessionId),
        );

      const conditions = [];
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(classSessions.date, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(classSessions.date, end));
      }
      if (selectedSubjectId) {
        conditions.push(eq(schedules.subjectId, selectedSubjectId));
      }
      if (selectedClassroomId) {
        conditions.push(eq(schedules.classroomId, selectedClassroomId));
      }
      if (scopedFacultyId) {
        conditions.push(eq(schedules.facultyId, scopedFacultyId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return query
        .groupBy(classSessions.id, schedules.id, subjects.id, classrooms.id)
        .orderBy(desc(classSessions.date));
    }
  }
};

const buildPdfBuffer = async (
  title: string,
  rows: Record<string, string>[],
  metadata: ReportMetadata,
) => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 36,
    info: {
      Title: title,
      Author: "CLIRDEC:PRESENCE",
      Subject: "Attendance reporting",
    },
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;
  const tableWidth = right - left;

  const drawFooter = () => {
    const bottom = pageHeight - 28;
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        "CLIRDEC:PRESENCE | College of Engineering | Confidential Academic Record",
        left,
        bottom,
        { width: tableWidth / 2 },
      )
      .text(`Page ${doc.bufferedPageRange().count}`, left, bottom, {
        width: tableWidth,
        align: "right",
      });
  };

  const drawHeader = (isFirstPage = false) => {
    doc.rect(0, 0, pageWidth, 92).fill("#0f172a");
    doc.rect(0, 88, pageWidth, 4).fill("#06b6d4");
    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .text("CLIRDEC:PRESENCE", left, 24, { characterSpacing: 0.5 })
      .fontSize(24)
      .text(title, left, 40, { width: tableWidth * 0.7 });
    doc
      .fontSize(9)
      .fillColor("#cbd5e1")
      .text("Department of Information Technology", left, 68);
    doc
      .fontSize(9)
      .fillColor("#e2e8f0")
      .text(formatReportDateTime(metadata.generatedAt), left, 36, {
        width: tableWidth,
        align: "right",
      });

    if (!isFirstPage) {
      doc.y = 116;
    }
  };

  drawHeader(true);

  let cursorY = 118;

  const cardGap = 10;
  const cardWidth = (tableWidth - cardGap * 3) / 4;
  metadata.summary.slice(0, 4).forEach((item, index) => {
    const x = left + index * (cardWidth + cardGap);
    doc.roundedRect(x, cursorY, cardWidth, 54, 4).fill("#f8fafc");
    doc
      .fillColor("#64748b")
      .fontSize(8)
      .text(item.label.toUpperCase(), x + 12, cursorY + 12, {
        width: cardWidth - 24,
      });
    doc
      .fillColor("#0f172a")
      .fontSize(17)
      .text(item.value, x + 12, cursorY + 28, { width: cardWidth - 24 });
  });

  cursorY += 72;

  const filterText = metadata.filters
    .map((filter) => `${filter.label}: ${filter.value}`)
    .join("   |   ");
  doc
    .fontSize(9)
    .fillColor("#334155")
    .text(filterText, left, cursorY, { width: tableWidth });
  cursorY = doc.y + 18;

  if (rows.length === 0) {
    doc
      .roundedRect(left, cursorY, tableWidth, 70, 4)
      .fillAndStroke("#f8fafc", "#cbd5e1");
    doc
      .fillColor("#334155")
      .fontSize(13)
      .text("No report data available for the selected filters.", left, cursorY + 24, {
        width: tableWidth,
        align: "center",
      });
    drawFooter();
    doc.end();
    return bufferPromise;
  }

  const headers = Object.keys(rows[0]);
  const maxColumns = Math.max(headers.length, 1);
  const columnWidth = tableWidth / maxColumns;
  const rowHeight = 30;
  const headerHeight = 26;

  const drawTableHeader = () => {
    doc.rect(left, cursorY, tableWidth, headerHeight).fill("#0f172a");
    headers.forEach((header, index) => {
      doc
        .fillColor("#ffffff")
        .fontSize(7)
        .text(header.toUpperCase(), left + index * columnWidth + 6, cursorY + 8, {
          width: columnWidth - 10,
          height: headerHeight - 10,
          ellipsis: true,
        });
    });
    cursorY += headerHeight;
  };

  drawTableHeader();

  rows.slice(0, 250).forEach((row, rowIndex) => {
    if (cursorY + rowHeight > pageHeight - 54) {
      drawFooter();
      doc.addPage();
      drawHeader();
      cursorY = 116;
      drawTableHeader();
    }

    doc
      .rect(left, cursorY, tableWidth, rowHeight)
      .fill(rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc");

    headers.forEach((header, index) => {
      const value = row[header] || "";
      const isStatus = header.toLowerCase() === "status";
      const normalized = value.toLowerCase();
      const statusColor =
        normalized === "present"
          ? "#047857"
          : normalized === "late"
            ? "#b45309"
            : normalized === "absent"
              ? "#b91c1c"
              : "#334155";

      doc
        .fillColor(isStatus ? statusColor : "#0f172a")
        .fontSize(7)
        .text(value, left + index * columnWidth + 6, cursorY + 8, {
          width: columnWidth - 10,
          height: rowHeight - 8,
          ellipsis: true,
        });
    });

    doc
      .moveTo(left, cursorY + rowHeight)
      .lineTo(right, cursorY + rowHeight)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();
    cursorY += rowHeight;
  });

  if (rows.length > 250) {
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `Showing first 250 rows of ${rows.length.toLocaleString()} records. Export CSV for the full data set.`,
        left,
        cursorY + 12,
        { width: tableWidth, align: "center" },
      );
  }

  drawFooter();

  doc.end();
  return bufferPromise;
};

const getDateRangeForReportPreset = (parameters: any) => {
  const datePreset = parameters?.datePreset;
  const today = new Date();
  const endDate = today.toISOString().split("T")[0];

  if (datePreset === "today") {
    return { startDate: endDate, endDate };
  }

  if (datePreset === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return { startDate: weekAgo.toISOString().split("T")[0], endDate };
  }

  if (datePreset === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: monthAgo.toISOString().split("T")[0], endDate };
  }

  return {
    startDate: parameters?.startDate,
    endDate: parameters?.endDate,
  };
};

const loadSchedulePresetParameters = async (presetId: string) => {
  const defaultPreset = defaultReportPresets.find(
    (preset) => String(preset.id) === presetId,
  );
  if (defaultPreset) return defaultPreset.parameters;

  const numericPresetId = parseInt(presetId, 10);
  if (!Number.isFinite(numericPresetId)) return null;

  const [preset] = await db
    .select({ parameters: reportPresets.parameters })
    .from(reportPresets)
    .where(
      and(eq(reportPresets.id, numericPresetId), eq(reportPresets.isActive, true)),
    )
    .limit(1);

  return preset?.parameters || null;
};

const deliverScheduledReport = async (schedule: typeof reportSchedules.$inferSelect) => {
  const parameters = await loadSchedulePresetParameters(schedule.presetId);
  if (!parameters || typeof parameters !== "object") {
    throw new Error("Scheduled report preset was not found");
  }

  const type = (parameters as any).type;
  if (!["attendance", "students", "classroom"].includes(type)) {
    throw new Error("Scheduled report preset has an invalid report type");
  }

  const [owner] = schedule.createdBy
    ? await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, schedule.createdBy))
        .limit(1)
    : [];
  const { startDate, endDate } = getDateRangeForReportPreset(parameters);
  const subjectId = (parameters as any).subjectId;
  const classroomId = (parameters as any).classroomId;
  const [selectedSubject] = subjectId
    ? await db
        .select({ code: subjects.code, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.id, Number(subjectId)))
        .limit(1)
    : [];
  const [selectedClassroom] = classroomId
    ? await db
        .select({ name: classrooms.name, location: classrooms.location })
        .from(classrooms)
        .where(eq(classrooms.id, Number(classroomId)))
        .limit(1)
    : [];

  const data = await loadReportRows({
    type,
    startDate,
    endDate,
    subjectId,
    classroomId,
    isFaculty: owner?.role === "faculty",
    facultyUserId: Number(schedule.createdBy || 0),
  });

  if (data.length === 0) {
    throw new Error("No records found for the scheduled report filters");
  }

  const displayRows = buildDisplayRows(type, data);
  const filteredDisplay = filterReportColumns(
    displayRows.length > 0 ? Object.keys(displayRows[0]) : [],
    displayRows,
    (parameters as any).columns,
  );
  const reportTitle = `${toTitle(type)} Report`;
  const subjectLabel = selectedSubject
    ? `${selectedSubject.code} ${selectedSubject.name}`
    : "All Subjects";
  const classroomLabel = selectedClassroom
    ? selectedClassroom.location
      ? `${selectedClassroom.name} ${selectedClassroom.location}`
      : selectedClassroom.name
    : "All Sections";
  const dateLabel =
    startDate && endDate
      ? `${formatReportDate(startDate)} to ${formatReportDate(endDate)}`
      : startDate
        ? `From ${formatReportDate(startDate)}`
        : endDate
          ? `Through ${formatReportDate(endDate)}`
          : "All Dates";
  const generatedAt = new Date();
  const artifact = await buildReportArtifact({
    type,
    format: schedule.format,
    data,
    columns: (parameters as any).columns,
    filteredDisplay,
    reportTitle,
    metadata: {
      generatedAt,
      filters: [
        { label: "Date Range", value: dateLabel },
        { label: "Subject", value: subjectLabel },
        { label: "Class Section", value: classroomLabel },
        { label: "Source", value: `Scheduled: ${schedule.name}` },
      ],
      summary: buildSummary(type, displayRows),
    },
    filenameBase: buildReportFilename(
      `scheduled-${type}`,
      subjectLabel,
      classroomLabel,
      startDate,
      endDate,
    ),
  });

  const sent = await emailService.sendEmail({
    to: schedule.recipientEmail,
    subject: `${schedule.name} ready`,
    htmlContent: `
      <h2>${schedule.name}</h2>
      <p>Your scheduled report generated ${data.length.toLocaleString()} matching records.</p>
      <ul>
        <li>Preset: ${schedule.presetName}</li>
        <li>Date range: ${dateLabel}</li>
        <li>Format: ${artifact.format.toUpperCase()}</li>
      </ul>
      <p>The generated report file is attached.</p>
    `,
    textContent: `${schedule.name} generated ${data.length.toLocaleString()} records from preset ${schedule.presetName}. The generated report file is attached.`,
    attachments: [{ name: artifact.filename, content: artifact.body }],
  });

  if (!sent) {
    throw new Error("Email service is not configured; scheduled report was not sent");
  }

  await db.insert(reportHistory).values({
    reportType: type,
    generatedBy: schedule.createdBy,
    filePath: artifact.filename,
    parameters: {
      ...(parameters as any),
      format: artifact.format,
      startDate,
      endDate,
      subjectLabel,
      classroomLabel,
      source: "scheduled",
      scheduleId: schedule.id,
      scheduleName: schedule.name,
    },
    recordCount: data.length,
    status: "completed",
  });
};

const runScheduledReport = async (schedule: typeof reportSchedules.$inferSelect) => {
  try {
    await deliverScheduledReport(schedule);
    await db
      .update(reportSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt: calculateNextReportRun(
          schedule.frequency as ScheduleFrequency,
          schedule.timeOfDay,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
        ),
        lastStatus: "completed",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, schedule.id));
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled report failed";
    await db
      .update(reportSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt: calculateNextReportRun(
          schedule.frequency as ScheduleFrequency,
          schedule.timeOfDay,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
        ),
        lastStatus: "failed",
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, schedule.id));
    console.error(`Scheduled report ${schedule.id} failed:`, error);
    return false;
  }
};

let persistentReportRunnerStarted = false;
const processDueReportSchedules = async () => {
  const dueSchedules = await db
    .select()
    .from(reportSchedules)
    .where(
      and(
        eq(reportSchedules.isActive, true),
        lte(reportSchedules.nextRunAt, new Date()),
      ),
    );

  for (const schedule of dueSchedules) {
    await runScheduledReport(schedule);
  }
};

const startPersistentReportScheduleRunner = () => {
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    typeof process.env.JEST_WORKER_ID !== "undefined";

  if (isTestEnv || persistentReportRunnerStarted) return;
  persistentReportRunnerStarted = true;

  const timer = setInterval(() => {
    processDueReportSchedules().catch((error) => {
      console.error("Failed to process scheduled reports:", error);
    });
  }, 60_000);
  timer.unref?.();
};

// Get saved report schedules
router.get("/schedules", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.session?.userRole === "admin";
    const userId = Number(req.session?.userId);

    let query = db
      .select({
        id: reportSchedules.id,
        name: reportSchedules.name,
        presetId: reportSchedules.presetId,
        presetName: reportSchedules.presetName,
        createdBy: reportSchedules.createdBy,
        owner: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        frequency: reportSchedules.frequency,
        dayOfWeek: reportSchedules.dayOfWeek,
        dayOfMonth: reportSchedules.dayOfMonth,
        timeOfDay: reportSchedules.timeOfDay,
        format: reportSchedules.format,
        recipientEmail: reportSchedules.recipientEmail,
        isActive: reportSchedules.isActive,
        lastRunAt: reportSchedules.lastRunAt,
        nextRunAt: reportSchedules.nextRunAt,
        lastStatus: reportSchedules.lastStatus,
        lastError: reportSchedules.lastError,
        createdAt: reportSchedules.createdAt,
        updatedAt: reportSchedules.updatedAt,
      })
      .from(reportSchedules)
      .leftJoin(users, eq(reportSchedules.createdBy, users.id));

    if (!isAdmin) {
      query = query.where(eq(reportSchedules.createdBy, userId));
    }

    const schedules = await query.orderBy(desc(reportSchedules.updatedAt));

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error("Get report schedules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report schedules",
    });
  }
});

// Create a new report schedule
router.post("/schedules", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.session?.userId);
    const {
      name,
      presetId,
      presetName,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      format,
      recipientEmail,
      isActive = true,
    } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Schedule name is required",
      });
    }

    if (!presetId || typeof presetId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Choose a saved report preset before scheduling",
      });
    }

    if (!isScheduleFrequency(frequency)) {
      return res.status(400).json({
        success: false,
        message: "Schedule frequency must be daily, weekly, or monthly",
      });
    }

    if (!isValidTimeOfDay(timeOfDay)) {
      return res.status(400).json({
        success: false,
        message: "Schedule time must use HH:MM format",
      });
    }

    if (!isReportFormat(format)) {
      return res.status(400).json({
        success: false,
        message: "Report format must be CSV, XLSX, or PDF",
      });
    }

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({
        success: false,
        message: "Recipient email is required",
      });
    }

    const normalizedDayOfWeek =
      frequency === "weekly" ? Number(dayOfWeek ?? 1) : null;
    const normalizedDayOfMonth =
      frequency === "monthly" ? Number(dayOfMonth ?? 1) : null;

    if (
      frequency === "weekly" &&
      (!Number.isInteger(normalizedDayOfWeek) ||
        normalizedDayOfWeek < 0 ||
        normalizedDayOfWeek > 6)
    ) {
      return res.status(400).json({
        success: false,
        message: "Weekly schedules need a valid day of week",
      });
    }

    if (
      frequency === "monthly" &&
      (!Number.isInteger(normalizedDayOfMonth) ||
        normalizedDayOfMonth < 1 ||
        normalizedDayOfMonth > 31)
    ) {
      return res.status(400).json({
        success: false,
        message: "Monthly schedules need a day from 1 to 31",
      });
    }

    const nextRunAt = calculateNextReportRun(
      frequency,
      timeOfDay,
      normalizedDayOfWeek,
      normalizedDayOfMonth,
    );

    const [schedule] = await db
      .insert(reportSchedules)
      .values({
        name: name.trim(),
        presetId,
        presetName:
          typeof presetName === "string" && presetName.trim()
            ? presetName.trim()
            : "Report Preset",
        createdBy: userId,
        frequency,
        dayOfWeek: normalizedDayOfWeek,
        dayOfMonth: normalizedDayOfMonth,
        timeOfDay,
        format,
        recipientEmail,
        isActive: Boolean(isActive),
        nextRunAt,
        lastStatus: "pending",
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Report schedule created",
      data: schedule,
    });
  } catch (error) {
    console.error("Create report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create report schedule",
    });
  }
});

// Update a report schedule
router.put("/schedules/:id", requireAuth, async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const userId = Number(req.session?.userId);
    const isAdmin = req.session?.userRole === "admin";
    const { isActive, frequency, dayOfWeek, dayOfMonth, timeOfDay, format } =
      req.body;

    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule id",
      });
    }

    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    if (!isAdmin && schedule.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own report schedules",
      });
    }

    const nextFrequency = isScheduleFrequency(frequency)
      ? frequency
      : (schedule.frequency as ScheduleFrequency);
    const nextTimeOfDay = isValidTimeOfDay(timeOfDay)
      ? String(timeOfDay)
      : schedule.timeOfDay;
    const nextDayOfWeek =
      nextFrequency === "weekly" ? Number(dayOfWeek ?? schedule.dayOfWeek ?? 1) : null;
    const nextDayOfMonth =
      nextFrequency === "monthly"
        ? Number(dayOfMonth ?? schedule.dayOfMonth ?? 1)
        : null;

    const nextRunAt = calculateNextReportRun(
      nextFrequency,
      nextTimeOfDay,
      nextDayOfWeek,
      nextDayOfMonth,
    );

    await db
      .update(reportSchedules)
      .set({
        frequency: nextFrequency,
        dayOfWeek: nextDayOfWeek,
        dayOfMonth: nextDayOfMonth,
        timeOfDay: nextTimeOfDay,
        format: isReportFormat(format) ? format : schedule.format,
        isActive:
          typeof isActive === "boolean" ? isActive : Boolean(schedule.isActive),
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, scheduleId));

    res.json({
      success: true,
      message: "Report schedule updated",
    });
  } catch (error) {
    console.error("Update report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report schedule",
    });
  }
});

// Delete a report schedule
router.delete("/schedules/:id", requireAuth, async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const userId = Number(req.session?.userId);
    const isAdmin = req.session?.userRole === "admin";

    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule id",
      });
    }

    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    if (!isAdmin && schedule.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own report schedules",
      });
    }

    await db.delete(reportSchedules).where(eq(reportSchedules.id, scheduleId));

    res.json({
      success: true,
      message: "Report schedule deleted",
    });
  } catch (error) {
    console.error("Delete report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report schedule",
    });
  }
});

// Manually trigger a report
router.post("/schedules/:id/trigger", requireAdmin, async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);

    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule id",
      });
    }

    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    const success = await runScheduledReport(schedule);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Failed to trigger report",
      });
    }

    res.json({
      success: true,
      message: "Report triggered successfully",
    });
  } catch (error) {
    console.error("Trigger report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger report",
    });
  }
});

// Generate on-demand report
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { reportType, filters = {}, dateRange } = req.body;

    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
      });
    }

    // Create a temporary schedule for on-demand report
    const tempScheduleId = await reportSchedulerService.createSchedule({
      name: "On-Demand Report",
      type: "daily", // Doesn't matter for on-demand
      recipients: [], // Not used for on-demand
      reportType,
      filters,
      scheduleTime: "00:00",
      isActive: false,
    });

    // Generate the report (this is a bit of a hack, but works)
    // In a real implementation, you'd have a separate method for on-demand reports
    const success = await reportSchedulerService.triggerReport(tempScheduleId);

    // Clean up the temporary schedule
    reportSchedulerService.deleteSchedule(tempScheduleId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate report",
      });
    }

    res.json({
      success: true,
      message: "Report generated successfully",
      note: "Report has been sent to configured recipients",
    });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
});

// Get report templates
router.get("/templates", requireAuth, async (req, res) => {
  try {
    const templates = [
      {
        id: "attendance_summary",
        name: "Attendance Summary Report",
        description: "Comprehensive attendance statistics and trends",
        type: "attendance",
        defaultFilters: {},
      },
      {
        id: "student_performance",
        name: "Student Performance Report",
        description: "Individual student attendance and performance metrics",
        type: "performance",
        defaultFilters: {},
      },
      {
        id: "faculty_analytics",
        name: "Faculty Analytics Report",
        description: "Faculty performance and class analytics",
        type: "analytics",
        defaultFilters: {},
      },
      {
        id: "system_summary",
        name: "System Summary Report",
        description: "Overall system health and statistics",
        type: "summary",
        defaultFilters: {},
      },
    ];

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get report templates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report templates",
    });
  }
});

// Get normalized report preview rows for the Reports page.
router.get("/preview", requireAuth, async (req, res) => {
  try {
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
    const type = String(req.query.type || "attendance") as ReportType;

    if (!["attendance", "students", "classroom"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report type",
      });
    }

    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
    const offset = parsePositiveInt(req.query.offset, 0);
    const data = await loadReportRows({
      type,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      classroomId: req.query.classroomId as string | undefined,
      isFaculty,
      facultyUserId,
    });
    const total = data.length;
    const pageData = data.slice(offset, offset + limit);
    const displayRows = buildDisplayRows(type, pageData);
    const allDisplayRows = buildDisplayRows(type, data);

    res.json({
      success: true,
      data: displayRows,
      rawData: pageData,
      total,
      summary: buildSummary(type, allDisplayRows),
      columns: displayRows.length > 0 ? Object.keys(displayRows[0]) : [],
    });
  } catch (error) {
    console.error("Get report preview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report preview",
    });
  }
});

// Seed realistic local report data so empty development databases are usable.
router.post("/seed-demo-data", requireAdmin, async (req, res) => {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.RAILWAY_ENVIRONMENT
    ) {
      return res.status(403).json({
        success: false,
        message: "Demo data seeding is disabled in production environments",
      });
    }

    const stats = {
      subjects: 0,
      classrooms: 0,
      students: 0,
      schedules: 0,
      sessions: 0,
      attendanceRecords: 0,
      enrollments: 0,
    };

    const [faculty] = await db
      .select()
      .from(users)
      .where(eq(users.role, "faculty"))
      .limit(1);
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    const owner = faculty || adminUser;

    if (!owner) {
      return res.status(400).json({
        success: false,
        message: "Create an admin or faculty account before seeding demo data",
      });
    }

    const subjectSeeds = [
      {
        code: "DEMO101",
        name: "Applied Programming",
        description: "Demo subject for report previews",
      },
      {
        code: "DEMO202",
        name: "Database Systems",
        description: "Demo subject for report previews",
      },
      {
        code: "DEMO303",
        name: "Systems Integration",
        description: "Demo subject for report previews",
      },
    ];
    const demoSubjects = [];
    for (const seed of subjectSeeds) {
      const [existing] = await db
        .select()
        .from(subjects)
        .where(eq(subjects.code, seed.code))
        .limit(1);
      if (existing) {
        demoSubjects.push(existing);
        continue;
      }
      const [created] = await db
        .insert(subjects)
        .values({ ...seed, isActive: true })
        .returning();
      demoSubjects.push(created);
      stats.subjects += 1;
    }

    const classroomSeeds = [
      { name: "DEMO Lab A", location: "CLIRDEC Building", type: "laboratory" },
      { name: "DEMO Lab B", location: "CLIRDEC Building", type: "laboratory" },
    ];
    const demoClassrooms = [];
    for (const seed of classroomSeeds) {
      const [existing] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.name, seed.name))
        .limit(1);
      if (existing) {
        demoClassrooms.push(existing);
        continue;
      }
      const [created] = await db
        .insert(classrooms)
        .values({ ...seed, capacity: 35, isActive: true })
        .returning();
      demoClassrooms.push(created);
      stats.classrooms += 1;
    }

    const demoStudents = [];
    for (let index = 1; index <= 18; index += 1) {
      const studentId = `DEMO-${String(index).padStart(3, "0")}`;
      const [existing] = await db
        .select()
        .from(students)
        .where(eq(students.studentId, studentId))
        .limit(1);
      if (existing) {
        demoStudents.push(existing);
        continue;
      }

      const [created] = await db
        .insert(students)
        .values({
          studentId,
          name: `Demo Student ${String(index).padStart(2, "0")}`,
          email: `demo.student${index}@clirdec.edu`,
          year: (index % 4) + 1,
          section: ["A", "B", "C"][index % 3],
          parentEmail: `guardian${index}@example.com`,
          parentName: `Guardian ${index}`,
          isActive: true,
        })
        .returning();
      demoStudents.push(created);
      stats.students += 1;
    }

    const demoSchedules = [];
    for (let index = 0; index < demoSubjects.length; index += 1) {
      const subject = demoSubjects[index];
      const classroom = demoClassrooms[index % demoClassrooms.length];
      const [existing] = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.subjectId, subject.id),
            eq(schedules.classroomId, classroom.id),
            eq(schedules.facultyId, owner.id),
            eq(schedules.startTime, ["08:00", "10:00", "13:00"][index]),
          ),
        )
        .limit(1);
      if (existing) {
        demoSchedules.push(existing);
        continue;
      }

      const [created] = await db
        .insert(schedules)
        .values({
          subjectId: subject.id,
          classroomId: classroom.id,
          facultyId: owner.id,
          dayOfWeek: (index + 1) % 7,
          startTime: ["08:00", "10:00", "13:00"][index],
          endTime: ["10:00", "12:00", "15:00"][index],
          semester: "2nd Semester",
          academicYear: "2025-2026",
          isRecurring: true,
          recurrencePattern: "weekly",
          isActive: true,
        })
        .returning();
      demoSchedules.push(created);
      stats.schedules += 1;
    }

    for (const student of demoStudents) {
      for (const subject of demoSubjects.slice(0, 2)) {
        const [existingEnrollment] = await db
          .select()
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, student.id),
              eq(enrollments.subjectId, subject.id),
            ),
          )
          .limit(1);
        if (existingEnrollment) continue;

        await db.insert(enrollments).values({
          studentId: student.id,
          subjectId: subject.id,
          semester: "2nd Semester",
          academicYear: "2025-2026",
          isActive: true,
        });
        stats.enrollments += 1;
      }
    }

    const statuses = ["present", "late", "absent"] as const;
    for (let dayOffset = 0; dayOffset < 12; dayOffset += 1) {
      for (let scheduleIndex = 0; scheduleIndex < demoSchedules.length; scheduleIndex += 1) {
        const schedule = demoSchedules[scheduleIndex];
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - dayOffset);
        sessionDate.setHours(8 + scheduleIndex * 2, 0, 0, 0);

        const [existingSession] = await db
          .select()
          .from(classSessions)
          .where(
            and(
              eq(classSessions.scheduleId, schedule.id),
              eq(classSessions.date, sessionDate),
            ),
          )
          .limit(1);
        const session =
          existingSession ||
          (
            await db
              .insert(classSessions)
              .values({
                scheduleId: schedule.id,
                date: sessionDate,
                status: dayOffset === 0 ? "active" : "completed",
                isActive: true,
              })
              .returning()
          )[0];

        if (!existingSession) stats.sessions += 1;

        for (const [studentIndex, student] of demoStudents.entries()) {
          const [existingRecord] = await db
            .select()
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.studentId, student.id),
                eq(attendanceRecords.classSessionId, session.id),
              ),
            )
            .limit(1);
          if (existingRecord) continue;

          const status = statuses[(studentIndex + dayOffset + scheduleIndex) % statuses.length];
          const entryTime = new Date(sessionDate);
          entryTime.setMinutes(status === "late" ? 18 : 4);
          const exitTime = status === "absent" ? null : new Date(entryTime);
          if (exitTime) exitTime.setHours(exitTime.getHours() + 1, 45, 0, 0);

          await db.insert(attendanceRecords).values({
            studentId: student.id,
            classSessionId: session.id,
            entryTime: status === "absent" ? null : entryTime,
            exitTime,
            status,
            rfidDetected: status !== "absent",
            sensorDetected: status !== "absent",
            isValid: status !== "absent",
            notes: status === "absent" ? "Demo absence record" : null,
            isActive: true,
            createdAt: entryTime,
            updatedAt: entryTime,
          });
          stats.attendanceRecords += 1;
        }
      }
    }

    res.json({
      success: true,
      message: "Demo report data is ready",
      data: stats,
    });
  } catch (error) {
    console.error("Seed report demo data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to seed demo report data",
    });
  }
});

router.delete("/seed-demo-data", requireAdmin, async (req, res) => {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.RAILWAY_ENVIRONMENT
    ) {
      return res.status(403).json({
        success: false,
        message: "Demo data reset is disabled in production environments",
      });
    }

    const demoStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(like(students.studentId, "DEMO-%"));
    const demoSubjects = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(like(subjects.code, "DEMO%"));
    const demoClassrooms = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(like(classrooms.name, "DEMO%"));
    const demoStudentIds = demoStudents.map((student) => student.id);
    const demoSubjectIds = demoSubjects.map((subject) => subject.id);
    const demoClassroomIds = demoClassrooms.map((classroom) => classroom.id);

    const scheduleConditions = [];
    if (demoSubjectIds.length > 0) {
      scheduleConditions.push(inArray(schedules.subjectId, demoSubjectIds));
    }
    if (demoClassroomIds.length > 0) {
      scheduleConditions.push(inArray(schedules.classroomId, demoClassroomIds));
    }

    const demoSchedules =
      scheduleConditions.length > 0
        ? await db
            .select({ id: schedules.id })
            .from(schedules)
            .where(and(...scheduleConditions))
        : [];
    const demoScheduleIds = demoSchedules.map((schedule) => schedule.id);
    const demoSessions =
      demoScheduleIds.length > 0
        ? await db
            .select({ id: classSessions.id })
            .from(classSessions)
            .where(inArray(classSessions.scheduleId, demoScheduleIds))
        : [];
    const demoSessionIds = demoSessions.map((session) => session.id);

    if (demoStudentIds.length > 0) {
      await db
        .delete(attendanceRecords)
        .where(inArray(attendanceRecords.studentId, demoStudentIds));
      await db.delete(enrollments).where(inArray(enrollments.studentId, demoStudentIds));
    }
    if (demoSessionIds.length > 0) {
      await db
        .delete(attendanceRecords)
        .where(inArray(attendanceRecords.classSessionId, demoSessionIds));
      await db.delete(classSessions).where(inArray(classSessions.id, demoSessionIds));
    }
    if (demoScheduleIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.id, demoScheduleIds));
    }
    if (demoStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, demoStudentIds));
    }
    if (demoSubjectIds.length > 0) {
      await db.delete(subjects).where(inArray(subjects.id, demoSubjectIds));
    }
    if (demoClassroomIds.length > 0) {
      await db.delete(classrooms).where(inArray(classrooms.id, demoClassroomIds));
    }

    res.json({
      success: true,
      message: "Demo report data has been reset",
      data: {
        students: demoStudentIds.length,
        subjects: demoSubjectIds.length,
        classrooms: demoClassroomIds.length,
        schedules: demoScheduleIds.length,
        sessions: demoSessionIds.length,
      },
    });
  } catch (error) {
    console.error("Reset report demo data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset demo report data",
    });
  }
});

// Get attendance records for preview (used by frontend Reports page)
router.get("/attendance-records", requireAuth, async (req, res) => {
  try {
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
    const {
      limit = 10,
      offset = 0,
      date,
      startDate,
      endDate,
      subjectId,
      studentId,
      sessionId,
      status,
    } = req.query;

    // Build conditions first
    const conditions = [];

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(gte(attendanceRecords.createdAt, start));
      conditions.push(lte(attendanceRecords.createdAt, end));
    } else if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(attendanceRecords.createdAt, startOfDay));
      conditions.push(lte(attendanceRecords.createdAt, endOfDay));
    }

    if (studentId) {
      conditions.push(
        eq(attendanceRecords.studentId, parseInt(studentId as string)),
      );
    }

    if (sessionId) {
      conditions.push(
        eq(attendanceRecords.classSessionId, parseInt(sessionId as string)),
      );
    }

    if (status) {
      conditions.push(eq(attendanceRecords.status, status as string));
    }

    if (isFaculty) {
      conditions.push(eq(schedules.facultyId, facultyUserId));
    }

    const baseQuery = db
      .select({
        record: attendanceRecords,
        student: {
          id: students.id,
          name: students.name,
          studentId: students.studentId,
        },
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id));

    if (subjectId) {
      conditions.push(eq(schedules.subjectId, parseInt(subjectId as string)));
    }

    const query =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const countQuery = db
      .select({ total: sql<number>`count(*)` })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id));

    const [{ total = 0 } = { total: 0 }] =
      conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

    const records = await query
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: records,
      total: Number(total),
    });
  } catch (error) {
    console.error("Get attendance records error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance records",
    });
  }
});

// Generate report (used by frontend Reports page)
router.post("/generate-report", requireAuth, async (req, res) => {
  try {
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
    const {
      type,
      format = "csv",
      startDate,
      endDate,
      subjectId,
      classroomId,
      facultyId,
      quickReportType,
      columns,
      emailToMe,
      source,
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
      });
    }

    if (!["attendance", "students", "classroom"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report type",
      });
    }

    if (dateRangeIsInvalid(startDate, endDate)) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before or equal to end date",
      });
    }

    // Build query based on report type
    let query;
    let data = [];
    const [selectedSubject] = subjectId
      ? await db
          .select({
            code: subjects.code,
            name: subjects.name,
          })
          .from(subjects)
          .where(eq(subjects.id, parseInt(subjectId)))
          .limit(1)
      : [];
    const [selectedClassroom] = classroomId
      ? await db
          .select({
            name: classrooms.name,
            location: classrooms.location,
          })
          .from(classrooms)
          .where(eq(classrooms.id, parseInt(classroomId)))
          .limit(1)
      : [];

    switch (type) {
      case "attendance":
        query = db
          .select({
            record: attendanceRecords,
            student: {
              id: students.id,
              name: students.name,
              studentId: students.studentId,
            },
            session: {
              id: classSessions.id,
              subjectName: subjects.name,
            },
          })
          .from(attendanceRecords)
          .leftJoin(students, eq(attendanceRecords.studentId, students.id))
          .leftJoin(
            classSessions,
            eq(attendanceRecords.classSessionId, classSessions.id),
          )
          .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
          .leftJoin(subjects, eq(schedules.subjectId, subjects.id));

        // Apply date filters
        const conditions = [];
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          conditions.push(gte(attendanceRecords.createdAt, start));
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          conditions.push(lte(attendanceRecords.createdAt, end));
        }
        if (subjectId) {
          conditions.push(eq(schedules.subjectId, parseInt(subjectId)));
        }
        if (classroomId) {
          conditions.push(eq(schedules.classroomId, parseInt(classroomId)));
        }
        if (isFaculty) {
          conditions.push(eq(schedules.facultyId, facultyUserId));
        } else if (facultyId) {
          conditions.push(eq(schedules.facultyId, parseInt(facultyId)));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        data = await query.orderBy(desc(attendanceRecords.createdAt));
        break;

      case "students":
        query = db
          .select({
            student: students,
            enrollmentCount: sql<number>`count(${enrollments.id})`,
          })
          .from(students)
          .leftJoin(enrollments, eq(students.id, enrollments.studentId))
          .groupBy(students.id);

        data = await query;
        break;

      case "classroom":
        query = db
          .select({
            session: classSessions,
            schedule: {
              id: schedules.id,
              subjectId: schedules.subjectId,
              classroomId: schedules.classroomId,
            },
            subject: {
              code: subjects.code,
              name: subjects.name,
            },
            classroom: {
              name: classrooms.name,
              location: classrooms.location,
            },
            attendanceCount: sql<number>`count(${attendanceRecords.id})`,
            presentCount: sql<number>`count(case when ${attendanceRecords.status} = 'present' then 1 end)`,
          })
          .from(classSessions)
          .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
          .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
          .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
          .leftJoin(
            attendanceRecords,
            eq(classSessions.id, attendanceRecords.classSessionId),
          )
          .groupBy(classSessions.id, schedules.id, subjects.id, classrooms.id);

        // Apply date filters
        const sessionConditions = [];
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          sessionConditions.push(gte(classSessions.createdAt, start));
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          sessionConditions.push(lte(classSessions.createdAt, end));
        }
        if (subjectId) {
          sessionConditions.push(eq(schedules.subjectId, parseInt(subjectId)));
        }
        if (classroomId) {
          sessionConditions.push(
            eq(schedules.classroomId, parseInt(classroomId)),
          );
        }
        if (isFaculty) {
          sessionConditions.push(eq(schedules.facultyId, facultyUserId));
        } else if (facultyId) {
          sessionConditions.push(eq(schedules.facultyId, parseInt(facultyId)));
        }

        if (sessionConditions.length > 0) {
          query = query.where(and(...sessionConditions));
        }

        data = await query.orderBy(desc(classSessions.createdAt));
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    const quickLabel =
      typeof quickReportType === "string" &&
      ["daily", "weekly", "analytics"].includes(quickReportType)
        ? quickReportType
        : "";
    const reportTitle = `${quickLabel ? `${toTitle(quickLabel)} ` : ""}${toTitle(type)} Report`;
    const subjectLabel = selectedSubject
      ? `${selectedSubject.code} ${selectedSubject.name}`
      : "All Subjects";
    const classroomLabel = selectedClassroom
      ? selectedClassroom.location
        ? `${selectedClassroom.name} ${selectedClassroom.location}`
        : selectedClassroom.name
      : "All Sections";
    const dateLabel =
      startDate && endDate
        ? `${formatReportDate(startDate)} to ${formatReportDate(endDate)}`
        : startDate
          ? `From ${formatReportDate(startDate)}`
          : endDate
            ? `Through ${formatReportDate(endDate)}`
            : "All Dates";
    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          type === "attendance"
            ? "No attendance records found for the selected filters"
            : "No records found for the selected filters",
      });
    }

    const displayRows = buildDisplayRows(type, data);
    const filteredDisplay = filterReportColumns(
      displayRows.length > 0 ? Object.keys(displayRows[0]) : [],
      displayRows,
      columns,
    );
    const generatedAt = new Date();
    const metadata: ReportMetadata = {
      generatedAt,
      filters: [
        { label: "Date Range", value: dateLabel },
        { label: "Subject", value: subjectLabel },
        { label: "Class Section", value: classroomLabel },
        { label: "Report Type", value: reportTitle },
      ],
      summary: buildSummary(type, displayRows),
    };
    const filenameBase = buildReportFilename(
      quickLabel ? `${quickLabel}-${type}` : type,
      subjectLabel,
      classroomLabel,
      startDate,
      endDate,
    );
    const historySource =
      source === "download-again"
        ? "download-again"
        : emailToMe
          ? "email"
          : quickLabel
            ? "quick"
            : "manual";
    const historyParameters = {
      type,
      format: normalizeReportFormat(format),
      startDate,
      endDate,
      subjectId,
      classroomId,
      subjectLabel,
      classroomLabel,
      columns: Array.isArray(columns) ? columns : undefined,
      scope: isFaculty ? "assigned schedules" : "all accessible schedules",
      source: historySource,
      quickReportType: quickLabel || undefined,
    };
    const artifact = await buildReportArtifact({
      type,
      format,
      data,
      columns,
      filteredDisplay,
      reportTitle,
      metadata,
      filenameBase,
    });

    await db.insert(reportHistory).values({
      reportType: type,
      generatedBy: req.session?.userId ? Number(req.session.userId) : null,
      filePath: artifact.filename,
      parameters: historyParameters,
      recordCount: data.length,
      status: "completed",
    });

    if (emailToMe) {
      const [recipient] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, Number(req.session?.userId)))
        .limit(1);

      if (!recipient?.email) {
        return res.status(400).json({
          success: false,
          message: "Your user account does not have an email address",
        });
      }

      const sent = await emailService.sendEmail({
        to: recipient.email,
        subject: `${reportTitle} ready`,
        htmlContent: `
          <h2>${reportTitle}</h2>
          <p>Your report was generated with ${data.length.toLocaleString()} matching records.</p>
          <ul>
            <li>Date range: ${dateLabel}</li>
            <li>Subject: ${subjectLabel}</li>
            <li>Class section: ${classroomLabel}</li>
            <li>Format: ${artifact.format.toUpperCase()}</li>
          </ul>
          <p>The generated report file is attached to this email.</p>
        `,
        textContent: `${reportTitle} generated with ${data.length.toLocaleString()} records. Date range: ${dateLabel}. Subject: ${subjectLabel}. Class section: ${classroomLabel}. Format: ${artifact.format.toUpperCase()}. The generated report file is attached.`,
        attachments: [
          {
            name: artifact.filename,
            content: artifact.body,
          },
        ],
      });

      return res.json({
        success: sent,
        message: sent
          ? "Report emailed successfully"
          : "Email service is not configured; report was not sent",
        data: {
          type,
          format: artifact.format,
          recordCount: data.length,
          generatedAt,
          filename: artifact.filename,
        },
      });
    }

    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.filename}"`,
    );
    return res.send(artifact.body);
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
});

// Get report history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const isFaculty = req.session?.userRole === "faculty";
    const userId = Number(req.session?.userId);

    let query = db
      .select({
        id: reportHistory.id,
        reportType: reportHistory.reportType,
        generatedAt: reportHistory.generatedAt,
        generatedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        status: reportHistory.status,
        recordCount: reportHistory.recordCount,
        filePath: reportHistory.filePath,
        errorMessage: reportHistory.errorMessage,
        parameters: reportHistory.parameters,
      })
      .from(reportHistory)
      .leftJoin(users, eq(reportHistory.generatedBy, users.id));

    if (isFaculty) {
      query = query.where(eq(reportHistory.generatedBy, userId));
    }

    const history = await query
      .orderBy(desc(reportHistory.generatedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get report history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report history",
    });
  }
});

// Get saved report presets plus built-in defaults
router.get("/presets", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.session?.userRole === "admin";
    const userId = Number(req.session?.userId);
    const visibilityCondition = isAdmin
      ? or(
          eq(reportPresets.createdBy, userId),
          eq(reportPresets.visibility, "shared"),
          eq(reportPresets.visibility, "admin"),
        )
      : or(
          eq(reportPresets.createdBy, userId),
          eq(reportPresets.visibility, "shared"),
        );

    const savedPresets = await db
      .select({
        id: reportPresets.id,
        name: reportPresets.name,
        createdBy: reportPresets.createdBy,
        visibility: reportPresets.visibility,
        parameters: reportPresets.parameters,
        createdAt: reportPresets.createdAt,
        updatedAt: reportPresets.updatedAt,
      })
      .from(reportPresets)
      .where(and(eq(reportPresets.isActive, true), visibilityCondition))
      .orderBy(desc(reportPresets.updatedAt));

    res.json({
      success: true,
      data: [...defaultReportPresets, ...savedPresets],
    });
  } catch (error) {
    console.error("Get report presets error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report presets",
    });
  }
});

router.post("/presets", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.session?.userId);
    const isAdmin = req.session?.userRole === "admin";
    const { name, visibility = "personal", parameters } = req.body;
    const allowedVisibility = isAdmin
      ? ["personal", "shared", "admin"]
      : ["personal"];

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Preset name is required",
      });
    }

    if (!allowedVisibility.includes(visibility)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create that preset type",
      });
    }

    if (
      !parameters ||
      !["attendance", "students", "classroom"].includes(parameters.type) ||
      !["csv", "xlsx", "pdf"].includes(parameters.format)
    ) {
      return res.status(400).json({
        success: false,
        message: "Preset report type and format are required",
      });
    }

    const [preset] = await db
      .insert(reportPresets)
      .values({
        name: name.trim(),
        createdBy: userId,
        visibility,
        parameters,
        updatedAt: new Date(),
        isActive: true,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: preset,
    });
  } catch (error) {
    console.error("Create report preset error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save report preset",
    });
  }
});

router.delete("/presets/:id", requireAuth, async (req, res) => {
  try {
    const presetId = parseInt(req.params.id, 10);
    const userId = Number(req.session?.userId);
    const isAdmin = req.session?.userRole === "admin";

    if (!Number.isFinite(presetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid preset id",
      });
    }

    const [preset] = await db
      .select()
      .from(reportPresets)
      .where(and(eq(reportPresets.id, presetId), eq(reportPresets.isActive, true)))
      .limit(1);

    if (!preset) {
      return res.status(404).json({
        success: false,
        message: "Preset not found",
      });
    }

    if (!isAdmin && preset.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own presets",
      });
    }

    await db
      .update(reportPresets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(reportPresets.id, presetId));

    res.json({
      success: true,
      message: "Preset deleted",
    });
  } catch (error) {
    console.error("Delete report preset error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report preset",
    });
  }
});

// Get real-time attendance statistics
router.get("/real-time-stats", requireAuth, async (req, res) => {
  try {
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's attendance stats
    const todayStats = await db
      .select({
        status: attendanceRecords.status,
        count: sql<number>`count(*)`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, today),
          lt(attendanceRecords.createdAt, tomorrow),
          isFaculty ? eq(schedules.facultyId, facultyUserId) : undefined,
        ),
      )
      .groupBy(attendanceRecords.status);

    // Active sessions today
    const activeSessions = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          gte(classSessions.date, today),
          lt(classSessions.date, tomorrow),
          eq(classSessions.status, "active"),
          isFaculty ? eq(schedules.facultyId, facultyUserId) : undefined,
        ),
      );

    // Process stats
    let todayPresent = 0;
    let todayLate = 0;
    let todayAbsent = 0;

    todayStats.forEach((stat: any) => {
      switch (stat.status) {
        case "present":
          todayPresent = Number(stat.count);
          break;
        case "late":
          todayLate = Number(stat.count);
          break;
        case "absent":
          todayAbsent = Number(stat.count);
          break;
      }
    });

    res.json({
      success: true,
      data: {
        todayPresent,
        todayLate,
        todayAbsent,
        activeSessions: Number((activeSessions[0] as any)?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get real-time stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time statistics",
    });
  }
});

startPersistentReportScheduleRunner();

export default router;
