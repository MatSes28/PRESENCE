import { useState, useEffect } from "react";
import { api } from "../lib/api";

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

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.getAIInsights();
      if (response.success) {
        setAnalytics(response.data as AnalyticsData);
      } else {
        setError(response.message || "Failed to load analytics");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const runSeatingOptimization = async (sessionId: number) => {
    try {
      const response = await api.optimizeSeating(sessionId);
      if (response.success) {
        alert("AI seating optimization completed!");
        // Refresh analytics
        loadAnalytics();
      } else {
        alert(response.message || "Optimization failed");
      }
    } catch (err: any) {
      alert(err.message || "Optimization failed");
    }
  };

  const detectConflicts = async (sessionId: number) => {
    try {
      const response = await api.detectConflicts(sessionId);
      if (response.success) {
        const data = response.data as {
          detectedConflicts: any[];
          resolutions: any[];
        };
        alert(
          `Found ${data.detectedConflicts.length} conflicts. ${data.resolutions.length} resolutions suggested.`
        );
      } else {
        alert(response.message || "Conflict detection failed");
      }
    } catch (err: any) {
      alert(err.message || "Conflict detection failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing data with AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI Analytics Dashboard
        </h1>
        <p className="text-gray-600">
          Machine learning-powered insights for educational optimization
        </p>
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {analytics?.predictiveInsights?.map((insight, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-teal-500"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  insight.type === "performance"
                    ? "bg-blue-100 text-blue-800"
                    : insight.type === "engagement"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {insight.type}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(insight.confidence * 100)}% confidence
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {insight.title}
            </h3>
            <p className="text-gray-600 text-sm mb-3">{insight.description}</p>
            <div className="text-sm text-teal-600 font-medium">
              {insight.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Engagement Metrics
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Attendance Consistency</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.attendanceConsistency || 0) *
                    100
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Participation Rate</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.participationRate || 0) * 100
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Computer Utilization</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.computerUtilization || 0) * 100
                )}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Interaction Patterns</span>
              <span className="font-medium">
                {Math.round(
                  (analytics?.engagementMetrics?.interactionPatterns || 0) * 100
                )}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Seating Effectiveness
          </h2>
          <div className="space-y-3">
            {analytics?.seatingEffectiveness?.optimization?.map(
              (item: any, index: number) => (
                <div key={index} className="text-sm">
                  <div className="font-medium text-gray-900">
                    {item.message}
                  </div>
                  <div className="text-gray-600">{item.detail}</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* AI Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          AI-Powered Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => runSeatingOptimization(1)} // Replace with actual session ID
            className="px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105"
          >
            <div className="font-medium">Optimize Seating</div>
            <div className="text-sm opacity-90">AI-powered arrangement</div>
          </button>

          <button
            onClick={() => detectConflicts(1)} // Replace with actual session ID
            className="px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105"
          >
            <div className="font-medium">Detect Conflicts</div>
            <div className="text-sm opacity-90">Automated resolution</div>
          </button>

          <button
            onClick={loadAnalytics}
            className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105"
          >
            <div className="font-medium">Refresh Analytics</div>
            <div className="text-sm opacity-90">Update insights</div>
          </button>
        </div>
      </div>

      {/* Performance Trends */}
      {analytics?.performanceTrends?.insights && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Performance Insights
          </h2>
          <div className="space-y-3">
            {analytics.performanceTrends.insights.map(
              (insight: any, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    insight.impact === "positive"
                      ? "bg-green-50 border-l-4 border-green-500"
                      : insight.impact === "negative"
                      ? "bg-red-50 border-l-4 border-red-500"
                      : "bg-yellow-50 border-l-4 border-yellow-500"
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {insight.message}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
