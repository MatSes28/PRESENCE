import { useState } from "react";
import type { ReportHistoryFilters, ReportHistoryItem } from "./types";
import {
  emptyReportHistoryFilters,
  getFilenameFromDisposition,
} from "./reportUtils";
import { fetchReportHistory, fetchReportHistoryExport } from "./reportApi";

interface NotificationInput {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

const buildReportHistoryQueryParams = (
  filters: ReportHistoryFilters,
  limit?: number,
  offset?: number,
) => {
  const queryParams = new URLSearchParams();
  if (typeof limit === "number") queryParams.set("limit", limit.toString());
  if (typeof offset === "number") queryParams.set("offset", offset.toString());
  if (filters.type) queryParams.set("type", filters.type);
  if (filters.format) queryParams.set("format", filters.format);
  if (filters.source) queryParams.set("source", filters.source);
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.generatedBy.trim()) {
    queryParams.set("generatedBy", filters.generatedBy.trim());
  }
  if (filters.startDate) queryParams.set("startDate", filters.startDate);
  if (filters.endDate) queryParams.set("endDate", filters.endDate);
  return queryParams;
};

export const useReportHistory = (
  addNotification: (notification: NotificationInput) => void,
) => {
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [reportHistoryFilters, setReportHistoryFilters] =
    useState<ReportHistoryFilters>(emptyReportHistoryFilters);
  const [reportHistoryPagination, setReportHistoryPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
  });
  const [exportingHistory, setExportingHistory] = useState(false);

  const loadReportHistory = async (
    filters: ReportHistoryFilters = reportHistoryFilters,
    page = reportHistoryPagination.page,
  ) => {
    try {
      const offset = (page - 1) * reportHistoryPagination.limit;
      const queryParams = buildReportHistoryQueryParams(
        filters,
        reportHistoryPagination.limit,
        offset,
      );

      const data = await fetchReportHistory(queryParams);
      setReportHistory(data.success && Array.isArray(data.data) ? data.data : []);
      setReportHistoryPagination((prev) => ({
        ...prev,
        page,
        total: data.success ? Number(data.total || 0) : 0,
      }));
    } catch (error) {
      console.error("Failed to load report history:", error);
      setReportHistory([]);
      setReportHistoryPagination((prev) => ({
        ...prev,
        page,
        total: 0,
      }));
    }
  };

  const resetReportHistoryFilters = () => {
    setReportHistoryFilters(emptyReportHistoryFilters);
    loadReportHistory(emptyReportHistoryFilters, 1);
  };

  const clearReportHistoryFilter = (key: keyof ReportHistoryFilters) => {
    const nextFilters = { ...reportHistoryFilters, [key]: "" };
    setReportHistoryFilters(nextFilters);
    loadReportHistory(nextFilters, 1);
  };

  const exportReportHistoryCsv = async () => {
    setExportingHistory(true);
    try {
      const queryParams = buildReportHistoryQueryParams(reportHistoryFilters);
      const response = await fetchReportHistoryExport(queryParams);
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorData = contentType.includes("application/json")
          ? await response.json()
          : { message: await response.text() };
        throw new Error(errorData.message || "Failed to export history");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        getFilenameFromDisposition(response.headers.get("content-disposition")) ||
        `report-history_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Failed to export report history:", error);
      addNotification({
        type: "error",
        title: "History Export Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to export report history.",
      });
    } finally {
      setExportingHistory(false);
    }
  };

  return {
    reportHistory,
    reportHistoryFilters,
    reportHistoryPagination,
    exportingHistory,
    setReportHistoryFilters,
    loadReportHistory,
    resetReportHistoryFilters,
    clearReportHistoryFilter,
    exportReportHistoryCsv,
  };
};
