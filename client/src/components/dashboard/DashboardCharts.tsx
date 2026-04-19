import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DailyTrend {
  date: string;
  present: number;
  absent: number;
  rate: number;
}

interface HourlyPattern {
  hour: number | string;
  count: number;
}

interface DashboardChartsProps {
  dailyTrends?: DailyTrend[];
  hourlyPatterns?: HourlyPattern[];
}

const tooltipStyle = {
  backgroundColor: "#1F2937",
  border: "1px solid #374151",
  borderRadius: "0.5rem",
};

const DashboardCharts = ({
  dailyTrends = [],
  hourlyPatterns = [],
}: DashboardChartsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
      <h4 className="text-lg font-medium text-cyan-400 mb-4">
        Daily Attendance Trends
      </h4>
      {dailyTrends.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          No attendance data in this period. Record attendance to see trends.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="present"
              stroke="#10B981"
              strokeWidth={2}
              name="Present"
            />
            <Line
              type="monotone"
              dataKey="absent"
              stroke="#EF4444"
              strokeWidth={2}
              name="Absent"
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#06B6D4"
              strokeWidth={2}
              name="Attendance Rate (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>

    <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
      <h4 className="text-lg font-medium text-cyan-400 mb-4">
        Hourly Attendance Patterns
      </h4>
      {hourlyPatterns.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
          No hourly data in this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourlyPatterns}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="hour"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}:00`}
            />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => `${value}:00`}
            />
            <Bar dataKey="count" fill="#06B6D4" name="Attendance Events" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

export default DashboardCharts;
