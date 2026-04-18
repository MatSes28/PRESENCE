import { useCallback, useState } from "react";
import { fetchRealTimeStats, fetchReportPreview } from "./reportApi";
import { dateRangeError } from "./reportUtils";
import type { ReportParams, SummaryItem } from "./types";

interface NotificationInput {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

export const useReportPreview = (
  reportParams: ReportParams,
  addNotification: (notification: NotificationInput) => void,
) => {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [realTimeStats, setRealTimeStats] = useState({
    todayPresent: 0,
    todayAbsent: 0,
    todayLate: 0,
    activeSessions: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  const loadPreviewData = useCallback(
    async (page = pagination.page) => {
      const dateError = dateRangeError(
        reportParams.startDate,
        reportParams.endDate,
      );
      if (dateError) {
        setPreviewData([]);
        setSummary([]);
        setPagination((prev) => ({ ...prev, page: 1, total: 0 }));
        return;
      }

      setPreviewLoading(true);
      try {
        const offset = (page - 1) * pagination.limit;
        const queryParams = new URLSearchParams({
          type: reportParams.type,
          limit: pagination.limit.toString(),
          offset: offset.toString(),
        });
        if (reportParams.startDate) {
          queryParams.set("startDate", reportParams.startDate);
        }
        if (reportParams.endDate) {
          queryParams.set("endDate", reportParams.endDate);
        }
        if (reportParams.subjectId) {
          queryParams.set("subjectId", reportParams.subjectId.toString());
        }
        if (reportParams.classroomId) {
          queryParams.set("classroomId", reportParams.classroomId.toString());
        }

        const data = await fetchReportPreview(queryParams);

        if (data.success && Array.isArray(data.data)) {
          const rows = data.data;
          setPreviewData(rows);
          setSummary(Array.isArray(data.summary) ? data.summary : []);
          setPagination((prev) => ({
            ...prev,
            page,
            total: typeof data.total === "number" ? data.total : rows.length,
          }));
        } else {
          setPreviewData([]);
          setSummary([]);
          setPagination((prev) => ({ ...prev, page, total: 0 }));
        }
      } catch (error) {
        console.error("Failed to load preview data:", error);
        addNotification({
          type: "error",
          title: "Preview Error",
          message: "Failed to load report preview. Please check your connection.",
        });
        setPreviewData([]);
        setSummary([]);
        setPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        setPreviewLoading(false);
      }
    },
    [
      addNotification,
      pagination.limit,
      pagination.page,
      reportParams.classroomId,
      reportParams.endDate,
      reportParams.startDate,
      reportParams.subjectId,
      reportParams.type,
    ],
  );

  const loadRealTimeStats = useCallback(async () => {
    try {
      const data = await fetchRealTimeStats();

      if (data.success && data.data && typeof data.data === "object") {
        setRealTimeStats({
          todayPresent: Number(data.data.todayPresent) ?? 0,
          todayAbsent: Number(data.data.todayAbsent) ?? 0,
          todayLate: Number(data.data.todayLate) ?? 0,
          activeSessions: Number(data.data.activeSessions) ?? 0,
        });
      } else {
        setRealTimeStats({
          todayPresent: 0,
          todayAbsent: 0,
          todayLate: 0,
          activeSessions: 0,
        });
      }
    } catch (error) {
      console.error("Failed to load real-time stats:", error);
      setRealTimeStats({
        todayPresent: 0,
        todayAbsent: 0,
        todayLate: 0,
        activeSessions: 0,
      });
    }
  }, []);

  return {
    previewLoading,
    previewData,
    summary,
    realTimeStats,
    pagination,
    setPagination,
    loadPreviewData,
    loadRealTimeStats,
  };
};
