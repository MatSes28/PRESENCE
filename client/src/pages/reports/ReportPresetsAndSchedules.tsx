import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  ReportParams,
  ReportPresetItem,
  ReportPresetVisibility,
  ReportScheduleFrequency,
  ReportScheduleItem,
} from "./types";
import {
  dayNames,
  formatDateTimeLabel,
  formatScheduleCadence,
} from "./reportUtils";

interface ReportPresetsAndSchedulesProps {
  userRole?: string;
  reportPresets: ReportPresetItem[];
  selectedPresetId: string;
  selectedPreset?: ReportPresetItem;
  canEditSelectedPreset: boolean;
  deletingPresetId: string | null;
  duplicatingPreset: boolean;
  presetName: string;
  presetVisibility: ReportPresetVisibility;
  savingPreset: boolean;
  updatingPreset: boolean;
  reportSchedules: ReportScheduleItem[];
  schedulePresetId: string;
  scheduleName: string;
  scheduleFrequency: ReportScheduleFrequency;
  scheduleDayOfWeek: number;
  scheduleDayOfMonth: number;
  scheduleTime: string;
  scheduleFormat: ReportParams["format"];
  scheduleRecipient: string;
  scheduleActive: boolean;
  savingSchedule: boolean;
  runningScheduleId: number | null;
  updatingScheduleId: number | null;
  deletingScheduleId: number | null;
  applyReportPreset: (presetId: string) => void;
  handleDeletePreset: () => Promise<void>;
  handleDuplicatePreset: () => Promise<void>;
  handleChangeSelectedPresetVisibility: (
    visibility: ReportPresetVisibility,
  ) => Promise<void>;
  setPresetName: Dispatch<SetStateAction<string>>;
  setPresetVisibility: Dispatch<SetStateAction<ReportPresetVisibility>>;
  handleSavePreset: () => Promise<void>;
  handleUpdatePreset: () => Promise<void>;
  handleSavePresetCopy: () => Promise<void>;
  loadReportSchedules: () => Promise<void>;
  setSchedulePresetId: Dispatch<SetStateAction<string>>;
  setScheduleName: Dispatch<SetStateAction<string>>;
  setScheduleFrequency: Dispatch<SetStateAction<ReportScheduleFrequency>>;
  setScheduleDayOfWeek: Dispatch<SetStateAction<number>>;
  setScheduleDayOfMonth: Dispatch<SetStateAction<number>>;
  setScheduleTime: Dispatch<SetStateAction<string>>;
  setScheduleFormat: Dispatch<SetStateAction<ReportParams["format"]>>;
  setScheduleRecipient: Dispatch<SetStateAction<string>>;
  setScheduleActive: Dispatch<SetStateAction<boolean>>;
  handleCreateSchedule: () => Promise<void>;
  handleRunScheduleNow: (schedule: ReportScheduleItem) => Promise<void>;
  handleToggleSchedule: (schedule: ReportScheduleItem) => Promise<void>;
  handleDeleteSchedule: (schedule: ReportScheduleItem) => Promise<void>;
  setSelectedScheduleError: Dispatch<
    SetStateAction<{
      name: string;
      error: string;
    } | null>
  >;
  renderStatus: (value: string) => ReactNode;
}

export const ReportPresetsAndSchedules = ({
  userRole,
  reportPresets,
  selectedPresetId,
  selectedPreset,
  canEditSelectedPreset,
  deletingPresetId,
  duplicatingPreset,
  presetName,
  presetVisibility,
  savingPreset,
  updatingPreset,
  reportSchedules,
  schedulePresetId,
  scheduleName,
  scheduleFrequency,
  scheduleDayOfWeek,
  scheduleDayOfMonth,
  scheduleTime,
  scheduleFormat,
  scheduleRecipient,
  scheduleActive,
  savingSchedule,
  runningScheduleId,
  updatingScheduleId,
  deletingScheduleId,
  applyReportPreset,
  handleDeletePreset,
  handleDuplicatePreset,
  handleChangeSelectedPresetVisibility,
  setPresetName,
  setPresetVisibility,
  handleSavePreset,
  handleUpdatePreset,
  handleSavePresetCopy,
  loadReportSchedules,
  setSchedulePresetId,
  setScheduleName,
  setScheduleFrequency,
  setScheduleDayOfWeek,
  setScheduleDayOfMonth,
  setScheduleTime,
  setScheduleFormat,
  setScheduleRecipient,
  setScheduleActive,
  handleCreateSchedule,
  handleRunScheduleNow,
  handleToggleSchedule,
  handleDeleteSchedule,
  setSelectedScheduleError,
  renderStatus,
}: ReportPresetsAndSchedulesProps) => (
  <>
    <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="report-preset"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Load Preset
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              id="report-preset"
              value={selectedPresetId}
              onChange={(event) => applyReportPreset(event.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Choose a preset</option>
              {reportPresets.map((preset) => (
                <option key={preset.id} value={String(preset.id)}>
                  {preset.name}
                  {preset.isDefault ? " - Default" : ` - ${preset.visibility}`}
                </option>
              ))}
            </select>
            <button
              onClick={handleDeletePreset}
              disabled={
                !selectedPresetId ||
                deletingPresetId === selectedPresetId ||
                reportPresets.find(
                  (preset) => String(preset.id) === selectedPresetId,
                )?.isDefault
              }
              className="px-3 py-2 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 whitespace-nowrap"
            >
              {deletingPresetId === selectedPresetId ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={handleDuplicatePreset}
              disabled={!selectedPresetId || duplicatingPreset}
              className="px-3 py-2 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 whitespace-nowrap"
            >
              {duplicatingPreset ? "Duplicating..." : "Duplicate"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Defaults are available to everyone. Saved presets keep filters,
            format, and columns.
          </p>
          {selectedPreset && (
            <div className="mt-3 flex flex-col gap-2 rounded border border-gray-700 bg-gray-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-400">
                Selected:{" "}
                <span className="font-medium text-gray-200">
                  {selectedPreset.name}
                </span>
                {selectedPreset.isDefault
                  ? " is a default template."
                  : " can be reused across exports and schedules."}
              </div>
              {userRole === "admin" && !selectedPreset.isDefault && (
                <select
                  value={selectedPreset.visibility}
                  onChange={(event) =>
                    handleChangeSelectedPresetVisibility(
                      event.target.value as ReportPresetVisibility,
                    )
                  }
                  disabled={!canEditSelectedPreset || updatingPreset}
                  className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-800 disabled:text-gray-500"
                >
                  <option value="personal">Personal</option>
                  <option value="shared">Shared</option>
                  <option value="admin">Admin Only</option>
                </select>
              )}
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="report-preset-name"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Save Current Filters
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="report-preset-name"
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Weekly Attendance - All Subjects"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {userRole === "admin" && (
              <select
                value={presetVisibility}
                onChange={(event) =>
                  setPresetVisibility(
                    event.target.value as ReportPresetVisibility,
                  )
                }
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="personal">Personal</option>
                <option value="shared">Shared</option>
                <option value="admin">Admin Only</option>
              </select>
            )}
            <button
              onClick={handleSavePreset}
              disabled={savingPreset}
              className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-cyan-800 whitespace-nowrap"
            >
              {savingPreset ? "Saving..." : "Save Preset"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={handleUpdatePreset}
              disabled={!canEditSelectedPreset || updatingPreset}
              className="rounded bg-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              {updatingPreset ? "Updating..." : "Update Selected Preset"}
            </button>
            <button
              onClick={handleSavePresetCopy}
              disabled={savingPreset}
              className="rounded bg-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              Save as Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <h5 className="text-sm font-medium text-white">Scheduled Reports</h5>
          <p className="text-xs text-gray-400">
            Send a saved preset automatically by email.
            {userRole === "admin" && " Admins can run schedules immediately."}
          </p>
        </div>
        <button
          onClick={loadReportSchedules}
          className="self-start bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
        >
          Refresh Schedules
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 mb-5">
        <div className="lg:col-span-2">
          <label
            htmlFor="schedule-preset"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Preset
          </label>
          <select
            id="schedule-preset"
            value={schedulePresetId}
            onChange={(event) => {
              const presetId = event.target.value;
              const preset = reportPresets.find(
                (item) => String(item.id) === presetId,
              );
              setSchedulePresetId(presetId);
              if (preset) {
                setScheduleFormat(preset.parameters.format);
                if (!scheduleName) {
                  setScheduleName(`${preset.name} Schedule`);
                }
              }
            }}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Choose a preset</option>
            {reportPresets.map((preset) => (
              <option key={preset.id} value={String(preset.id)}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="schedule-name"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Schedule Name
          </label>
          <input
            id="schedule-name"
            type="text"
            value={scheduleName}
            onChange={(event) => setScheduleName(event.target.value)}
            placeholder="Monday Attendance Email"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label
            htmlFor="schedule-frequency"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Frequency
          </label>
          <select
            id="schedule-frequency"
            value={scheduleFrequency}
            onChange={(event) =>
              setScheduleFrequency(
                event.target.value as ReportScheduleFrequency,
              )
            }
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="schedule-time"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Time
          </label>
          <input
            id="schedule-time"
            type="time"
            value={scheduleTime}
            onChange={(event) => setScheduleTime(event.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        {scheduleFrequency === "weekly" && (
          <div>
            <label
              htmlFor="schedule-day-week"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Day
            </label>
            <select
              id="schedule-day-week"
              value={scheduleDayOfWeek}
              onChange={(event) =>
                setScheduleDayOfWeek(Number(event.target.value))
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {dayNames.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        )}
        {scheduleFrequency === "monthly" && (
          <div>
            <label
              htmlFor="schedule-day-month"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Day
            </label>
            <input
              id="schedule-day-month"
              type="number"
              min={1}
              max={31}
              value={scheduleDayOfMonth}
              onChange={(event) =>
                setScheduleDayOfMonth(Number(event.target.value))
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        )}
        <div>
          <label
            htmlFor="schedule-format"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Format
          </label>
          <select
            id="schedule-format"
            value={scheduleFormat}
            onChange={(event) =>
              setScheduleFormat(event.target.value as ReportParams["format"])
            }
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="schedule-recipient"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Recipient
          </label>
          <input
            id="schedule-recipient"
            type="email"
            value={scheduleRecipient}
            onChange={(event) => setScheduleRecipient(event.target.value)}
            placeholder="name@example.com"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
            <input
              type="checkbox"
              checked={scheduleActive}
              onChange={(event) => setScheduleActive(event.target.checked)}
              className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
            />
            Active
          </label>
          <button
            onClick={handleCreateSchedule}
            disabled={savingSchedule}
            className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-cyan-800 whitespace-nowrap"
          >
            {savingSchedule ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              {[
                "Name",
                "Preset",
                "Cadence",
                "Next Run",
                "Recipient",
                "Status",
                "Actions",
              ].map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {reportSchedules.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No scheduled reports yet.
                </td>
              </tr>
            ) : (
              reportSchedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-4 py-3 text-sm text-white">
                    {schedule.name}
                    {schedule.owner?.name && userRole === "admin" && (
                      <div className="text-xs text-gray-500">
                        {schedule.owner.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {schedule.presetName}
                    <div className="text-xs text-cyan-300 uppercase">
                      {schedule.format}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {formatScheduleCadence(schedule)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                    {formatDateTimeLabel(schedule.nextRunAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {schedule.recipientEmail}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderStatus(
                      schedule.isActive
                        ? schedule.lastStatus || "scheduled"
                        : "inactive",
                    )}
                    {schedule.lastError && (
                      <div className="mt-1 flex max-w-xs flex-col gap-1">
                        <div className="truncate text-xs text-red-300">
                          {schedule.lastError}
                        </div>
                        <button
                          onClick={() =>
                            setSelectedScheduleError({
                              name: schedule.name,
                              error: schedule.lastError || "",
                            })
                          }
                          className="self-start text-xs font-medium text-red-200 hover:text-red-100"
                        >
                          View error
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    <div className="flex gap-2">
                      {userRole === "admin" && (
                        <button
                          onClick={() => handleRunScheduleNow(schedule)}
                          disabled={runningScheduleId === schedule.id}
                          className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-cyan-900 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                        >
                          {runningScheduleId === schedule.id
                            ? "Running..."
                            : "Run Now"}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleSchedule(schedule)}
                        disabled={updatingScheduleId === schedule.id}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                      >
                        {updatingScheduleId === schedule.id
                          ? "Updating..."
                          : schedule.isActive
                            ? "Pause"
                            : "Resume"}
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule)}
                        disabled={deletingScheduleId === schedule.id}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                      >
                        {deletingScheduleId === schedule.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
);
