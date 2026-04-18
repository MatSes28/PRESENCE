import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReportFilters } from "./ReportFilters";
import type {
  ClassroomOption,
  ReportDatePreset,
  ReportParams,
  SubjectOption,
} from "./types";

const subjects: SubjectOption[] = [
  { id: 1, code: "IT101", name: "Intro to Computing" },
];

const classrooms: ClassroomOption[] = [
  { id: 10, name: "Lab A", location: "Main Building" },
];

interface HarnessProps {
  handleGenerateReport?: (
    formatOverride?: ReportParams["format"],
  ) => Promise<void>;
  initialColumns?: string[];
  validationMessage?: string;
}

const ReportFiltersHarness = ({
  handleGenerateReport = vi.fn(),
  initialColumns = [],
  validationMessage = "",
}: HarnessProps) => {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("custom");
  const [reportParams, setReportParams] = useState<ReportParams>({
    type: "attendance",
    format: "xlsx",
    startDate: "2026-04-01",
    endDate: "2026-04-18",
  });
  const [selectedColumns, setSelectedColumns] = useState(initialColumns);
  const [emailReport, setEmailReport] = useState(false);
  const previewColumns = ["Student Name", "Status", "Recorded At"];
  const selectedExportColumns =
    selectedColumns.length > 0
      ? selectedColumns.filter((column) => previewColumns.includes(column))
      : previewColumns;

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) => {
      const source = current.length > 0 ? current : previewColumns;
      return source.includes(column)
        ? source.filter((item) => item !== column)
        : [...source, column];
    });
  };

  return (
    <>
      <ReportFilters
        datePreset={datePreset}
        reportParams={reportParams}
        subjects={subjects}
        classrooms={classrooms}
        validationMessage={validationMessage}
        previewColumns={previewColumns}
        selectedExportColumns={selectedExportColumns}
        emailReport={emailReport}
        generating={false}
        paginationTotal={3}
        previewLoading={false}
        setDatePreset={setDatePreset}
        setReportParams={setReportParams}
        setSelectedColumns={setSelectedColumns}
        setEmailReport={setEmailReport}
        toggleColumn={toggleColumn}
        handleGenerateReport={handleGenerateReport}
      />
      <output data-testid="report-state">
        {JSON.stringify({ datePreset, reportParams, selectedExportColumns })}
      </output>
    </>
  );
};

describe("ReportFilters", () => {
  it("applies date presets and keeps report params in sync", async () => {
    const user = userEvent.setup();
    render(<ReportFiltersHarness />);

    await user.selectOptions(screen.getByLabelText(/date range/i), "today");

    const state = JSON.parse(
      screen.getByTestId("report-state").textContent || "{}",
    );
    expect(state.datePreset).toBe("today");
    expect(state.reportParams.startDate).toBe(state.reportParams.endDate);
  });

  it("updates report filters and toggles export columns", async () => {
    const user = userEvent.setup();
    render(<ReportFiltersHarness />);

    await user.selectOptions(screen.getByLabelText(/subject/i), "1");
    await user.selectOptions(screen.getByLabelText(/class section/i), "10");
    await user.selectOptions(screen.getByLabelText(/report type/i), "students");
    await user.click(screen.getByLabelText("Status"));

    const state = JSON.parse(
      screen.getByTestId("report-state").textContent || "{}",
    );
    expect(state.reportParams.subjectId).toBe(1);
    expect(state.reportParams.classroomId).toBe(10);
    expect(state.reportParams.type).toBe("students");
    expect(state.selectedExportColumns).not.toContain("Status");
  });

  it("passes explicit export format overrides to the generate handler", async () => {
    const user = userEvent.setup();
    const handleGenerateReport = vi.fn().mockResolvedValue(undefined);
    render(<ReportFiltersHarness handleGenerateReport={handleGenerateReport} />);

    await user.click(screen.getByRole("button", { name: /raw csv/i }));
    await user.click(screen.getByRole("button", { name: /pdf/i }));

    expect(handleGenerateReport).toHaveBeenNthCalledWith(1, "csv");
    expect(handleGenerateReport).toHaveBeenNthCalledWith(2, "pdf");
  });

  it("shows validation messages and disables export actions", () => {
    render(
      <ReportFiltersHarness validationMessage="Start date must be before end date." />,
    );

    expect(screen.getByText("Start date must be before end date.")).toBeVisible();
    expect(screen.getByRole("button", { name: /generate report/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /pdf/i })).toBeDisabled();
  });
});
