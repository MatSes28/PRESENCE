import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

interface Schedule {
  id: number;
  subjectId: number;
  subjectName: string;
  classroomId: number;
  classroomName: string;
  facultyId: number;
  facultyName: string;
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
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
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
  const [uploadingCsv, setUploadingCsv] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchSessions();
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      // Fetch subjects, classrooms, and faculty for dropdowns
      const [subjectsRes, classroomsRes, usersRes] = await Promise.all([
        fetch("/api/subjects").then((r) => r.json()),
        api.getClassrooms(),
        api.getUsers(),
      ]);

      if (subjectsRes.success && Array.isArray(subjectsRes.data))
        setSubjects(subjectsRes.data);
      if (classroomsRes.success && Array.isArray(classroomsRes.data))
        setClassrooms(classroomsRes.data);
      if (usersRes.success && Array.isArray(usersRes.data))
        setFaculty(usersRes.data.filter((u: any) => u.role === "faculty"));
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
    }
  };

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
      const response = await fetch("/api/sessions");
      const data = await response.json();
      if (data.success) {
        // Process sessions data if needed
        console.log("Sessions:", data.sessions);
      }
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

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append("csv", file);

      const response = await fetch("/api/schedules/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: "success",
          title: "CSV Upload Successful",
          message: `Successfully imported ${result.imported} schedules`,
        });
        fetchSchedules();
      } else {
        addNotification({
          type: "error",
          title: "CSV Upload Failed",
          message: result.message || "Failed to import schedules from CSV",
        });
      }
    } catch (error) {
      console.error("CSV upload error:", error);
      addNotification({
        type: "error",
        title: "Upload Error",
        message: "Failed to upload CSV file. Please try again.",
      });
    } finally {
      setUploadingCsv(false);
      // Reset file input
      event.target.value = "";
    }
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
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">
            Class Schedule Management
          </h3>
          <p className="text-sm text-gray-300">
            Manage class timetables and sessions
          </p>
        </div>
        <div className="flex space-x-3">
          <label
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              uploadingCsv ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploadingCsv ? "Uploading..." : "Upload CSV"}
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={uploadingCsv}
              className="hidden"
            />
          </label>
          {user?.role === "admin" && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Add Schedule
            </button>
          )}
        </div>
      </div>

      {/* Add Schedule Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            Add New Schedule
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject *
                </label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) =>
                    setFormData({ ...formData, subjectId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject: any) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Classroom *
                </label>
                <select
                  required
                  value={formData.classroomId}
                  onChange={(e) =>
                    setFormData({ ...formData, classroomId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select Classroom</option>
                  {classrooms.map((classroom: any) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} ({classroom.location})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Faculty *
                </label>
                <select
                  required
                  value={formData.facultyId}
                  onChange={(e) =>
                    setFormData({ ...formData, facultyId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select Faculty</option>
                  {faculty.map((member: any) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Day of Week *
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, dayOfWeek: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index.toString()}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Semester *
                </label>
                <select
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({ ...formData, semester: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Academic Year *
                </label>
                <input
                  type="text"
                  required
                  value={formData.academicYear}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYear: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="2024-2025"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={submitting}
                loadingText="Adding..."
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Schedule
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Current Week Schedule */}
      <div className="bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Current Week Schedule
          </h4>
          <p className="text-sm text-gray-300">
            Weekly class timetable with auto-start indicators
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 gap-px bg-gray-700">
            {/* Time column header */}
            <div className="bg-gray-900 px-4 py-3 text-sm font-medium text-gray-300">
              Time
            </div>
            {/* Day headers */}
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="bg-gray-900 px-4 py-3 text-sm font-medium text-gray-300 text-center"
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
                  <div className="bg-gray-800 px-4 py-8 text-sm text-gray-400 border-r border-gray-700">
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
                        className="bg-gray-800 px-2 py-2 min-h-16 border-r border-gray-700"
                      >
                        {hourSchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="bg-cyan-900 border border-cyan-700 rounded p-2 mb-1 text-xs relative"
                          >
                            <div className="font-medium text-cyan-300">
                              {schedule.subjectName}
                            </div>
                            <div className="text-cyan-400">
                              {schedule.classroomName}
                            </div>
                            <div className="text-cyan-400">
                              {formatTime(schedule.startTime)} -{" "}
                              {formatTime(schedule.endTime)}
                            </div>
                            <div className="absolute top-1 right-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-600 text-white">
                                Auto
                              </span>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📚</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Total Classes
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {schedules.length}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🔄</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">Auto-Start</dt>
              <dd className="text-2xl font-semibold text-white">
                {schedules.length}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🏫</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Unique Rooms
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {new Set(schedules.map((s) => s.classroomId)).size}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📖</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">Subjects</dt>
              <dd className="text-2xl font-semibold text-white">
                {new Set(schedules.map((s) => s.subjectId)).size}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            All Schedules ({schedules.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Classroom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Day
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Semester
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {schedule.subjectName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {schedule.classroomName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {DAYS_OF_WEEK[schedule.dayOfWeek]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {formatTime(schedule.startTime)} -{" "}
                    {formatTime(schedule.endTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {schedule.semester} {schedule.academicYear}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schedules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              No schedules found. Add your first schedule to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
