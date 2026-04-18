import { useEffect, useState } from "react";
import {
  createReportSchedule,
  deleteReportSchedule,
  fetchReportSchedules,
  triggerReportSchedule,
  updateReportSchedule,
} from "./reportApi";
import type {
  ReportParams,
  ReportPresetItem,
  ReportScheduleFrequency,
  ReportScheduleItem,
} from "./types";

interface NotificationInput {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

export const useReportSchedules = (
  userEmail: string | undefined,
  reportPresets: ReportPresetItem[],
  loadReportHistory: () => Promise<void>,
  addNotification: (notification: NotificationInput) => void,
) => {
  const [reportSchedules, setReportSchedules] = useState<ReportScheduleItem[]>(
    [],
  );
  const [schedulePresetId, setSchedulePresetId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] =
    useState<ReportScheduleFrequency>("weekly");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleFormat, setScheduleFormat] =
    useState<ReportParams["format"]>("xlsx");
  const [scheduleRecipient, setScheduleRecipient] = useState(userEmail || "");
  const [scheduleActive, setScheduleActive] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<number | null>(
    null,
  );
  const [runningScheduleId, setRunningScheduleId] = useState<number | null>(
    null,
  );
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!scheduleRecipient && userEmail) {
      setScheduleRecipient(userEmail);
    }
  }, [scheduleRecipient, userEmail]);

  const loadReportSchedules = async () => {
    try {
      const data = await fetchReportSchedules();
      setReportSchedules(
        data.success && Array.isArray(data.data) ? data.data : [],
      );
    } catch (error) {
      console.error("Failed to load report schedules:", error);
      setReportSchedules([]);
    }
  };

  const handleCreateSchedule = async () => {
    const preset = reportPresets.find(
      (item) => String(item.id) === schedulePresetId,
    );
    const trimmedName = scheduleName.trim();
    const trimmedRecipient = scheduleRecipient.trim();

    if (!preset) {
      addNotification({
        type: "warning",
        title: "Preset Required",
        message: "Choose the preset this schedule should send.",
      });
      return;
    }

    if (!trimmedName) {
      addNotification({
        type: "warning",
        title: "Schedule Name Required",
        message: "Name this scheduled report before saving it.",
      });
      return;
    }

    if (!trimmedRecipient) {
      addNotification({
        type: "warning",
        title: "Recipient Required",
        message: "Add the email address that should receive this report.",
      });
      return;
    }

    setSavingSchedule(true);
    try {
      const data = await createReportSchedule({
        name: trimmedName,
        presetId: String(preset.id),
        presetName: preset.name,
        frequency: scheduleFrequency,
        dayOfWeek: scheduleDayOfWeek,
        dayOfMonth: scheduleDayOfMonth,
        timeOfDay: scheduleTime,
        format: scheduleFormat,
        recipientEmail: trimmedRecipient,
        isActive: scheduleActive,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save report schedule");
      }

      setScheduleName("");
      await loadReportSchedules();
      addNotification({
        type: "success",
        title: "Schedule Saved",
        message: `${trimmedName} will send automatically.`,
      });
    } catch (error) {
      console.error("Failed to save report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Save Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save report schedule.",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (schedule: ReportScheduleItem) => {
    setUpdatingScheduleId(schedule.id);
    try {
      const data = await updateReportSchedule(schedule.id, {
        isActive: !schedule.isActive,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update report schedule");
      }

      await loadReportSchedules();
    } catch (error) {
      console.error("Failed to update report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Update Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update report schedule.",
      });
    } finally {
      setUpdatingScheduleId(null);
    }
  };

  const handleRunScheduleNow = async (schedule: ReportScheduleItem) => {
    setRunningScheduleId(schedule.id);
    try {
      const data = await triggerReportSchedule(schedule.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to run report schedule");
      }

      await Promise.all([loadReportSchedules(), loadReportHistory()]);
      addNotification({
        type: "success",
        title: "Schedule Ran",
        message: `${schedule.name} generated and emailed a report.`,
      });
    } catch (error) {
      console.error("Failed to run report schedule:", error);
      await loadReportSchedules();
      addNotification({
        type: "error",
        title: "Run Now Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to run this report schedule.",
      });
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleDeleteSchedule = async (schedule: ReportScheduleItem) => {
    setDeletingScheduleId(schedule.id);
    try {
      const data = await deleteReportSchedule(schedule.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to delete report schedule");
      }

      await loadReportSchedules();
      addNotification({
        type: "success",
        title: "Schedule Deleted",
        message: `${schedule.name} has been removed.`,
      });
    } catch (error) {
      console.error("Failed to delete report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Delete Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete report schedule.",
      });
    } finally {
      setDeletingScheduleId(null);
    }
  };

  return {
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
    updatingScheduleId,
    runningScheduleId,
    deletingScheduleId,
    setSchedulePresetId,
    setScheduleName,
    setScheduleFrequency,
    setScheduleDayOfWeek,
    setScheduleDayOfMonth,
    setScheduleTime,
    setScheduleFormat,
    setScheduleRecipient,
    setScheduleActive,
    loadReportSchedules,
    handleCreateSchedule,
    handleToggleSchedule,
    handleRunScheduleNow,
    handleDeleteSchedule,
  };
};
