import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

interface AIInsight {
  type: string;
  title: string;
  description: string;
  confidence: number;
  recommendation: string;
}

interface AnalyticsData {
  performanceTrends: any;
  attendancePatterns: any;
  seatingEffectiveness: any;
  engagementMetrics: any;
  predictiveInsights: AIInsight[];
}

export const AIAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadAnalytics();
    loadSessions();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.getAIInsights();
      const data = (response as any).data ?? response;
      if (response.success && data) {
        setAnalytics({
          performanceTrends: data.performanceTrends ?? data.performance,
          attendancePatterns: data.attendancePatterns ?? data.attendance,
          seatingEffectiveness: data.seatingEffectiveness ?? data.seating,
          engagementMetrics: data.engagementMetrics ?? data.engagement,
          predictiveInsights: data.predictiveInsights ?? data.insights ?? [],
        } as AnalyticsData);
      } else {
        setError((response as any).message || "Failed to load analytics");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await api.get("/sessions");
      let sessionsList: any[] = [];
      if (response != null && typeof response === "object") {
        const r = response as Record<string, unknown>;
        if (Array.isArray(r.sessions)) {
          sessionsList = r.sessions;
        } else if (r.data != null && typeof r.data === "object") {
          const d = (r.data as Record<string, unknown>).sessions;
          if (Array.isArray(d)) sessionsList = d;
        }
      }
      setSessions(sessionsList);
      const activeSession = sessionsList.find(
        (s: any) => s?.session?.status === "active",
      );
      if (activeSession?.session?.id) {
        setSelectedSessionId(activeSession.session.id);
      }
    } catch (err: any) {
      console.error("Failed to load sessions:", err);
      setSessions([]);
    }
  };

  const runSeatingOptimization = async (sessionId: number) => {
    try {
      const response = await api.optimizeSeating(sessionId);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Seating Optimization Complete",
          message: "AI seating optimization has been completed successfully.",
        });
        // Refresh analytics
        loadAnalytics();
      } else {
        addNotification({
          type: "error",
          title: "Optimization Failed",
          message: response.message || "Seating optimization failed.",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Optimization Error",
        message:
          err.message || "An error occurred during seating optimization.",
      });
    }
  };

  const detectConflicts = async (sessionId: number) => {
    try {
      const response = await api.detectConflicts(sessionId);
      const data = (response as any).data ?? response;
      const conflicts = data?.detectedConflicts ?? [];
      const resolutions = data?.resolutions ?? [];
      if (response.success) {
        addNotification({
          type: "info",
          title: "Conflict Detection Complete",
          message: `Found ${conflicts.length} conflicts. ${resolutions.length} resolutions suggested.`,
        });
      } else {
        addNotification({
          type: "error",
          title: "Conflict Detection Failed",
          message: response.message || "Failed to detect conflicts.",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Conflict Detection Error",
        message: err.message || "An error occurred during conflict detection.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Analyzing data with AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          AI Analytics Dashboard
        </h1>
        <p className="text-gray-300">
          Machine learning-powered insights for educational optimization
        </p>
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {analytics?.predictiveInsights?.map((insight, index) => (
          <div
            key={index}
            className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700 border-l-4 border-teal-500"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  insight.type === "performance"
                    ? "bg-blue-900/50 text-blue-300"
                    : insight.type === "engagement"
                      ? "bg-green-900/50 text-green-300"
                      : "bg-amber-900/50 text-amber-300"
                }`}
              >
                {insight.type}
              </span>
              <span className="text-sm text-gray-400">
                {Math.round(insight.confidence * 100)}% confidence
              </span>
            </div>
            <h3 className="font-semibold text-white mb-2">{insight.title}</h3>
            <p className="text-gray-300 text-sm mb-3">{insight.description}</p>
            <div className="text-sm text-teal-400 font-medium">
              {insight.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">
            Engagement Metrics
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Attendance Consistency</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.attendanceConsistency || 0) *
                    100,
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Participation Rate</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.participationRate || 0) * 100,
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Computer Utilization</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.computerUtilization || 0) *
                    100,
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Interaction Patterns</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.interactionPatterns || 0) *
                    100,
                )}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">
            Seating Effectiveness
          </h2>
          <div className="space-y-3">
            {analytics?.seatingEffectiveness?.optimization?.map(
              (item: any, index: number) => (
                <div key={index} className="text-sm">
                  <div className="font-medium text-white">{item.message}</div>
                  <div className="text-gray-300">{item.detail}</div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Session Selector */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">
          Select Session
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <label
            htmlFor="session-select"
            className="text-sm font-medium text-gray-300 shrink-0"
          >
            Active Session:
          </label>
          <select
            id="session-select"
            value={selectedSessionId || ""}
            onChange={(e) =>
              setSelectedSessionId(Number(e.target.value) || null)
            }
            className="w-full sm:w-auto min-w-0 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors text-sm font-medium"
          >
            <option value="">Select a session...</option>
            {sessions.map((sessionData) => (
              <option
                key={sessionData.session.id}
                value={sessionData.session.id}
              >
                {sessionData.schedule.subject} -{" "}
                {sessionData.schedule.classroom} (
                {new Date(sessionData.session.date).toLocaleDateString()}) [
                {sessionData.session.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Actions */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">
          AI-Powered Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() =>
              selectedSessionId && runSeatingOptimization(selectedSessionId)
            }
            disabled={!selectedSessionId}
            className={`min-h-[44px] px-4 py-3 rounded-lg transition-all duration-200 text-left ${
              selectedSessionId
                ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
            }`}
          >
            <div className="font-medium">Optimize Seating</div>
            <div className={`text-sm mt-0.5 ${selectedSessionId ? "text-cyan-100" : "text-gray-400"}`}>
              AI-powered arrangement
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              selectedSessionId && detectConflicts(selectedSessionId)
            }
            disabled={!selectedSessionId}
            className={`min-h-[44px] px-4 py-3 rounded-lg transition-all duration-200 text-left ${
              selectedSessionId
                ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
            }`}
          >
            <div className="font-medium">Detect Conflicts</div>
            <div className={`text-sm mt-0.5 ${selectedSessionId ? "text-cyan-100" : "text-gray-400"}`}>
              Automated resolution
            </div>
          </button>

          <button
            type="button"
            onClick={loadAnalytics}
            className="min-h-[44px] px-4 py-3 rounded-lg transition-all duration-200 text-left bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            <div className="font-medium">Refresh Analytics</div>
            <div className="text-sm text-cyan-100 mt-0.5">Update insights</div>
          </button>
        </div>
      </div>

      {/* Performance Trends */}
      {analytics?.performanceTrends?.insights && (
        <div className="mt-8 bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">
            Performance Insights
          </h2>
            <div className="space-y-3">
              {analytics.performanceTrends.insights.map(
                (insight: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      insight.impact === "positive"
                        ? "bg-green-900/30 border-green-500 text-gray-200"
                        : insight.impact === "negative"
                        ? "bg-red-900/30 border-red-500 text-gray-200"
                        : "bg-amber-900/30 border-amber-500 text-gray-200"
                    }`}
                  >
                    <div className="font-medium">
                      {insight.message}
                    </div>
                  </div>
                ),
              )}
            </div>
        </div>
      )}
    </div>
  );
};
