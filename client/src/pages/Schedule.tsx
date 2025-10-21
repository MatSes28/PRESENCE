import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";

interface Schedule {
  id: number;
  subjectId: number;
  subjectName?: string;
  classroomId: number;
  classroomName?: string;
  facultyId: number;
  facultyName?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  semester: string;
  academicYear: string;
  createdAt: string;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const Schedule = () => {
  const { addNotification } = useNotifications();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: "",
    classroomId: "",
    facultyId: "",
    dayOfWeek: "1",
    startTime: "08:00",
    endTime: "09:30",
    semester: "1st Semester",
    academicYear: new Date().getFullYear().toString(),
  });

  useEffect(() => {
    fetchSchedules();
    fetchSessions();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await api.getSchedules();
      if (response.success) {
        setSchedules((response.data as Schedule[]) || []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Schedules",
          message: response.message || "Unable to fetch schedule data",
        });
        setSchedules([]);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setSchedules([]);
    }
  };

  const fetchSessions = async () => {
    try {
      // This would need a backend endpoint for sessions
      // For now, we'll show a placeholder
      // setSessions([]);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.subjectId || !formData.classroomId || !formData.facultyId) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fill in all required fields",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.createSchedule({
        subjectId: parseInt(formData.subjectId),
        classroomId: parseInt(formData.classroomId),
        facultyId: parseInt(formData.facultyId),
        dayOfWeek: parseInt(formData.dayOfWeek),
        startTime: formData.startTime,
        endTime: formData.endTime,
        semester: formData.semester,
        academicYear: formData.academicYear,
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Schedule Added",
          message: "Schedule has been successfully created!",
        });
        fetchSchedules();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Save Failed",
          message: response.message || "Failed to create schedule",
        });
      }
    } catch (error) {
      console.error("Failed to create schedule:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to save schedule. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      subjectId: "",
      classroomId: "",
      facultyId: "",
      dayOfWeek: "1",
      startTime: "08:00",
      endTime: "09:30",
      semester: "1st Semester",
      academicYear: new Date().getFullYear().toString(),
    });
    setShowAddForm(false);
  };

  const getSchedulesForDay = (dayOfWeek: number) => {
    return schedules.filter((schedule) => schedule.dayOfWeek === dayOfWeek);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Class Schedule Management
          </h3>
          <p className="text-sm text-gray-500">
            Manage class timetables and sessions
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Schedule
        </button>
      </div>

      {/* Add Schedule Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium mb-4">Add New Schedule</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.subjectId}
                  onChange={(e) =>
                    setFormData({ ...formData, subjectId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Subject ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classroom ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.classroomId}
                  onChange={(e) =>
                    setFormData({ ...formData, classroomId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Classroom ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faculty ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.facultyId}
                  onChange={(e) =>
                    setFormData({ ...formData, facultyId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Faculty ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week *
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, dayOfWeek: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index.toString()}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester *
                </label>
                <select
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({ ...formData, semester: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year *
                </label>
                <input
                  type="text"
                  required
                  value={formData.academicYear}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYear: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="2024-2025"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={submitting}
                loadingText="Adding..."
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Schedule
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Weekly Schedule View */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900">Weekly Schedule</h4>
          <p className="text-sm text-gray-500">
            Current semester class timetable
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 gap-px bg-gray-200">
            {/* Time column header */}
            <div className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
              Time
            </div>
            {/* Day headers */}
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 text-center"
              >
                {day}
              </div>
            ))}

            {/* Time slots */}
            {Array.from({ length: 12 }, (_, i) => {
              const hour = 8 + i; // Start from 8 AM
              const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${
                hour >= 12 ? "PM" : "AM"
              }`;

              return (
                <div key={hour} className="contents">
                  <div className="bg-white px-4 py-8 text-sm text-gray-500 border-r">
                    {timeLabel}
                  </div>
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const daySchedules = getSchedulesForDay(dayIndex);
                    const hourSchedules = daySchedules.filter((schedule) => {
                      const startHour = parseInt(
                        schedule.startTime.split(":")[0]
                      );
                      return startHour === hour;
                    });

                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="bg-white px-2 py-2 min-h-16 border-r"
                      >
                        {hourSchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="bg-teal-100 border border-teal-200 rounded p-2 mb-1 text-xs"
                          >
                            <div className="font-medium text-teal-800">
                              Subject {schedule.subjectId}
                            </div>
                            <div className="text-teal-600">
                              Room {schedule.classroomId}
                            </div>
                            <div className="text-teal-600">
                              {formatTime(schedule.startTime)} -{" "}
                              {formatTime(schedule.endTime)}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900">
            All Schedules ({schedules.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classroom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Semester
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Subject {schedule.subjectId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Room {schedule.classroomId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {DAYS_OF_WEEK[schedule.dayOfWeek]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(schedule.startTime)} -{" "}
                    {formatTime(schedule.endTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.semester} {schedule.academicYear}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schedules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No schedules found. Add your first schedule to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
