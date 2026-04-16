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
} from "../schema.js";
import { eq, and, gte, lte, lt, desc, sql } from "drizzle-orm";
import { reportSchedulerService } from "../services/reportScheduler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

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

  return [{ label: "Rows", value: rows.length.toLocaleString() }];
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

// Get all report schedules
router.get("/schedules", requireAuth, async (req, res) => {
  try {
    const schedules = reportSchedulerService.getAllSchedules();

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
router.post("/schedules", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      type,
      recipients,
      reportType,
      filters,
      scheduleTime,
      isActive = true,
    } = req.body;

    if (!name || !type || !recipients || !reportType || !scheduleTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const scheduleId = await reportSchedulerService.createSchedule({
      name,
      type,
      recipients,
      reportType,
      filters: filters || {},
      scheduleTime,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Report schedule created successfully",
      data: { scheduleId },
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
router.put("/schedules/:id", requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const updates = req.body;

    const success = await reportSchedulerService.updateSchedule(
      scheduleId,
      updates,
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    res.json({
      success: true,
      message: "Report schedule updated successfully",
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
router.delete("/schedules/:id", requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;

    const success = await reportSchedulerService.deleteSchedule(scheduleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    res.json({
      success: true,
      message: "Report schedule deleted successfully",
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
    const scheduleId = req.params.id;

    const success = await reportSchedulerService.triggerReport(scheduleId);

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
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
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
    const displayRows = buildDisplayRows(type, data);
    const metadata: ReportMetadata = {
      generatedAt: new Date(),
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

    // Generate CSV or return JSON data
    if (format === "csv") {
      const { headers, rows } = buildCsvRows(type, data);
      const csv = buildStrictCsv(headers, rows);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.csv"`,
      );
      return res.send(csv);
    }

    if (format === "xlsx" || format === "excel") {
      const { headers, rows } = buildCsvRows(type, data);
      const excelBuffer = await buildExcelBuffer(
        reportTitle,
        headers,
        rows,
        metadata,
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.xlsx"`,
      );
      return res.send(excelBuffer);
    }

    if (format === "pdf") {
      const pdfBuffer = await buildPdfBuffer(reportTitle, displayRows, metadata);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.pdf"`,
      );
      return res.send(pdfBuffer);
    }

    // For JSON format or empty data, return the data directly
    res.json({
      success: true,
      message: "Report data retrieved successfully",
      data: {
        type,
        format,
        recordCount: data.length,
        generatedAt: new Date(),
        data,
      },
    });
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
    const { limit = 20, offset = 0 } = req.query;

    const history = await db
      .select({
        id: reportHistory.id,
        reportType: reportHistory.reportType,
        generatedAt: reportHistory.generatedAt,
        status: reportHistory.status,
        recordCount: reportHistory.recordCount,
        filePath: reportHistory.filePath,
        errorMessage: reportHistory.errorMessage,
        parameters: reportHistory.parameters,
      })
      .from(reportHistory)
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

export default router;
