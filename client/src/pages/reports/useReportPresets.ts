import { useMemo, useState } from "react";
import {
  createReportPreset,
  deleteReportPreset,
  duplicateReportPreset,
  fetchReportPresets,
  updateReportPreset,
} from "./reportApi";
import { getDateRangeForPreset, toTitle } from "./reportUtils";
import type {
  ReportDatePreset,
  ReportParams,
  ReportPresetItem,
  ReportPresetParameters,
  ReportPresetVisibility,
} from "./types";

interface NotificationInput {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

interface ReportUser {
  id?: number;
  role?: string;
}

interface UseReportPresetsOptions {
  user?: ReportUser | null;
  reportParams: ReportParams;
  datePreset: ReportDatePreset;
  selectedExportColumns: string[];
  setDatePreset: (datePreset: ReportDatePreset) => void;
  setReportParams: (reportParams: ReportParams) => void;
  setSelectedColumns: (columns: string[]) => void;
  onPresetApplied: (presetId: string, preset: ReportPresetItem) => void;
  addNotification: (notification: NotificationInput) => void;
}

export const useReportPresets = ({
  user,
  reportParams,
  datePreset,
  selectedExportColumns,
  setDatePreset,
  setReportParams,
  setSelectedColumns,
  onPresetApplied,
  addNotification,
}: UseReportPresetsOptions) => {
  const [reportPresets, setReportPresets] = useState<ReportPresetItem[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetVisibility, setPresetVisibility] =
    useState<ReportPresetVisibility>("personal");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [updatingPreset, setUpdatingPreset] = useState(false);
  const [duplicatingPreset, setDuplicatingPreset] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => reportPresets.find((preset) => String(preset.id) === selectedPresetId),
    [reportPresets, selectedPresetId],
  );
  const canEditSelectedPreset =
    !!selectedPreset &&
    !selectedPreset.isDefault &&
    typeof selectedPreset.id === "number" &&
    (user?.role === "admin" || selectedPreset.createdBy === user?.id);

  const currentPresetParameters = (): ReportPresetParameters => ({
    ...reportParams,
    datePreset,
    columns: selectedExportColumns,
  });

  const loadReportPresets = async () => {
    try {
      const data = await fetchReportPresets();
      setReportPresets(
        data.success && Array.isArray(data.data) ? data.data : [],
      );
    } catch (error) {
      console.error("Failed to load report presets:", error);
      setReportPresets([]);
    }
  };

  const handleSavePreset = async () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      addNotification({
        type: "warning",
        title: "Preset Name Required",
        message: "Name this preset before saving it.",
      });
      return;
    }

    setSavingPreset(true);
    try {
      const data = await createReportPreset({
        name: trimmedName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
        parameters: {
          ...reportParams,
          datePreset,
          columns: selectedExportColumns,
        },
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save preset");
      }

      setPresetName("");
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Saved",
        message: `${trimmedName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to save report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Save Failed",
        message:
          error instanceof Error ? error.message : "Failed to save preset.",
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPreset || !canEditSelectedPreset) return;
    if (typeof selectedPreset.id !== "number") return;

    setUpdatingPreset(true);
    try {
      const data = await updateReportPreset(selectedPreset.id, {
        name: selectedPreset.name,
        visibility:
          user?.role === "admin" ? selectedPreset.visibility : "personal",
        parameters: currentPresetParameters(),
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update preset");
      }

      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Updated",
        message: `${selectedPreset.name} now uses the current report setup.`,
      });
    } catch (error) {
      console.error("Failed to update report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Update Failed",
        message:
          error instanceof Error ? error.message : "Failed to update preset.",
      });
    } finally {
      setUpdatingPreset(false);
    }
  };

  const handleSavePresetCopy = async () => {
    const sourceName = selectedPreset?.name || "Report Preset";
    const copyName = presetName.trim() || `${sourceName} Copy`;

    setSavingPreset(true);
    try {
      const data = await createReportPreset({
        name: copyName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
        parameters: currentPresetParameters(),
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save preset copy");
      }
      if (!data.data?.id) {
        throw new Error("Preset copy response did not include an id");
      }

      setPresetName("");
      setSelectedPresetId(String(data.data.id));
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Copied",
        message: `${copyName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to save report preset copy:", error);
      addNotification({
        type: "error",
        title: "Preset Copy Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save preset copy.",
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDuplicatePreset = async () => {
    if (!selectedPreset) return;

    setDuplicatingPreset(true);
    try {
      const duplicateName = presetName.trim() || `${selectedPreset.name} Copy`;
      const body = {
        name: duplicateName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
      };
      const data =
        typeof selectedPreset.id === "number"
          ? await duplicateReportPreset(selectedPreset.id, body)
          : await createReportPreset({
              name: duplicateName,
              visibility:
                user?.role === "admin" ? presetVisibility : "personal",
              parameters: selectedPreset.parameters,
            });

      if (!data.success) {
        throw new Error(data.message || "Failed to duplicate preset");
      }
      if (!data.data?.id) {
        throw new Error("Duplicated preset response did not include an id");
      }

      setPresetName("");
      setSelectedPresetId(String(data.data.id));
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Duplicated",
        message: `${duplicateName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to duplicate report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Duplicate Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to duplicate preset.",
      });
    } finally {
      setDuplicatingPreset(false);
    }
  };

  const handleChangeSelectedPresetVisibility = async (
    visibility: ReportPresetVisibility,
  ) => {
    if (!selectedPreset || !canEditSelectedPreset || user?.role !== "admin") {
      return;
    }
    if (typeof selectedPreset.id !== "number") return;

    setUpdatingPreset(true);
    try {
      const data = await updateReportPreset(selectedPreset.id, {
        name: selectedPreset.name,
        visibility,
        parameters: selectedPreset.parameters,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update preset visibility");
      }

      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Visibility Updated",
        message: `${selectedPreset.name} is now ${toTitle(visibility)}.`,
      });
    } catch (error) {
      console.error("Failed to update preset visibility:", error);
      addNotification({
        type: "error",
        title: "Visibility Update Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update preset visibility.",
      });
    } finally {
      setUpdatingPreset(false);
    }
  };

  const applyReportPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    const preset = reportPresets.find((item) => String(item.id) === presetId);
    if (!preset) return;

    const presetDate = preset.parameters.datePreset || "custom";
    const computedDates = getDateRangeForPreset(presetDate);
    setDatePreset(presetDate);
    setReportParams({
      type: preset.parameters.type,
      format: preset.parameters.format,
      startDate: computedDates.startDate ?? preset.parameters.startDate,
      endDate: computedDates.endDate ?? preset.parameters.endDate,
      subjectId: preset.parameters.subjectId,
      classroomId: preset.parameters.classroomId,
    });
    setSelectedColumns(preset.parameters.columns || []);
    onPresetApplied(presetId, preset);
    addNotification({
      type: "success",
      title: "Preset Loaded",
      message: `${preset.name} has been applied.`,
    });
  };

  const handleDeletePreset = async () => {
    const preset = reportPresets.find(
      (item) => String(item.id) === selectedPresetId,
    );
    if (!preset || preset.isDefault || typeof preset.id !== "number") {
      return;
    }

    setDeletingPresetId(String(preset.id));
    try {
      const data = await deleteReportPreset(preset.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to delete preset");
      }

      setSelectedPresetId("");
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Deleted",
        message: `${preset.name} has been removed.`,
      });
    } catch (error) {
      console.error("Failed to delete report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Delete Failed",
        message:
          error instanceof Error ? error.message : "Failed to delete preset.",
      });
    } finally {
      setDeletingPresetId(null);
    }
  };

  return {
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
    setPresetName,
    setPresetVisibility,
    loadReportPresets,
    applyReportPreset,
    handleDeletePreset,
    handleDuplicatePreset,
    handleChangeSelectedPresetVisibility,
    handleSavePreset,
    handleUpdatePreset,
    handleSavePresetCopy,
  };
};
