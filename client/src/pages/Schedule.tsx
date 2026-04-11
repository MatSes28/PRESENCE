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

const getDefaultAcademicYear = () => {
  const startYear = new Date().getFullYear();
  return `${startYear}-${startYear + 1}`;
};

export const Schedule = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
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
    academicYear: getDefaultAcademicYear(),
  });
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Calendar view state
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchSessions();
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      const [subjectsRes, classroomsRes, usersRes] = await Promise.all([
        api.getSubjects(),
        api.getClassrooms(),
        user?.role === "admin"
          ? api.getUsers()
          : Promise.resolve({ success: true, data: [user] }),
      ]);

      const subjectsRaw = (subjectsRes as any)?.data;
      if (subjectsRes.success && Array.isArray(subjectsRaw)) setSubjects(subjectsRaw);
      else setSubjects([]);

      const classroomsRaw = (classroomsRes as any)?.data;
      if (classroomsRes.success && Array.isArray(classroomsRaw)) setClassrooms(classroomsRaw);
      else setClassrooms([]);

      const usersRaw = (usersRes as any)?.data;
      if (usersRes.success && Array.isArray(usersRaw)) {
        setFaculty(
          usersRaw.filter((u: any) => u && (u.role === "faculty" || u.role === "admin")),
        );
      } else {
        setFaculty([]);
      }
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
      setSubjects([]);
      setClassrooms([]);
      setFaculty([]);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await api.getSchedules();
      const raw = (response as any)?.data;
      if (response.success && Array.isArray(raw)) {
        setSchedules(raw as Schedule[]);
      } else {
        setSchedules([]);
        if (!response.success) {
          addNotification({
            type: "error",
            title: "Failed to Load Schedules",
            message: (response as any).message || "Unable to fetch schedule data",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      setSchedules([]);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      await api.getClassSessions();
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      // Don't show error notification for sessions, as it's not critical for schedule display
    }
  };

  // Helper function to check if two time ranges overlap
  const doTimesOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean => {
    const start1Minutes =
      parseInt(start1.split(":")[0]) * 60 + parseInt(start1.split(":")[1]);
    const end1Minutes =
      parseInt(end1.split(":")[0]) * 60 + parseInt(end1.split(":")[1]);
    const start2Minutes =
      parseInt(start2.split(":")[0]) * 60 + parseInt(start2.split(":")[1]);
    const end2Minutes =
      parseInt(end2.split(":")[0]) * 60 + parseInt(end2.split(":")[1]);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  };

  // Client-side conflict detection
  const checkScheduleConflicts = (
    newSchedule: any,
    excludeId?: number,
  ): any[] => {
    const conflicts: any[] = [];

    schedules.forEach((schedule) => {
      if (excludeId && schedule.id === excludeId) return;

      // Check for same day and semester/academic year
      if (
        schedule.dayOfWeek === newSchedule.dayOfWeek &&
        schedule.semester === newSchedule.semester &&
        schedule.academicYear === newSchedule.academicYear
      ) {
        // Check for time overlap
        if (
          doTimesOverlap(
            schedule.startTime,
            schedule.endTime,
            newSchedule.startTime,
            newSchedule.endTime,
          )
        ) {
          // Check classroom conflict
          if (schedule.classroomId === newSchedule.classroomId) {
            conflicts.push({
              type: "classroom",
              message: `Classroom ${
                schedule.classroomName
              } is already booked for ${schedule.subjectName} (${formatTime(
                schedule.startTime,
              )} - ${formatTime(schedule.endTime)})`,
              existingSchedule: schedule,
            });
          }

          // Check faculty conflict
          if (schedule.facultyId === newSchedule.facultyId) {
            conflicts.push({
              type: "faculty",
              message: `Faculty member ${
                schedule.facultyName
              } is already scheduled for ${schedule.subjectName} (${formatTime(
                schedule.startTime,
              )} - ${formatTime(schedule.endTime)})`,
              existingSchedule: schedule,
            });
          }
        }
      }
    });

    return conflicts;
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

    // Validate time range
    if (formData.startTime >= formData.endTime) {
      addNotification({
        type: "error",
        title: "Invalid Time Range",
        message: "End time must be after start time",
      });
      return;
    }

    // Client-side conflict detection first
    const newScheduleData = {
      subjectId: parseInt(formData.subjectId),
      classroomId: parseInt(formData.classroomId),
      facultyId: parseInt(formData.facultyId),
      dayOfWeek: parseInt(formData.dayOfWeek),
      startTime: formData.startTime,
      endTime: formData.endTime,
      semester: formData.semester,
      academicYear: formData.academicYear,
    };

    const clientConflicts = checkScheduleConflicts(
      newScheduleData,
      editingSchedule?.id,
    );
    if (clientConflicts.length > 0) {
      setConflicts(clientConflicts);
      addNotification({
        type: "warning",
        title: "Schedule Conflicts Detected",
        message: "Please review the conflicts below before proceeding.",
      });
      return;
    }

    // Check for conflicts via API as well
    setCheckingConflicts(true);
    try {
      const conflictCheck = await api.checkScheduleConflicts({
        ...newScheduleData,
        excludeId: editingSchedule?.id,
      });

      if (conflictCheck.success && (conflictCheck as any).hasConflicts) {
        setConflicts((conflictCheck as any).conflicts || []);
        addNotification({
          type: "warning",
          title: "Schedule Conflicts Detected",
          message: "Please review the conflicts below before proceeding.",
        });
        setCheckingConflicts(false);
        return;
      }

      setConflicts([]);
    } catch (error) {
      console.error("Failed to check conflicts:", error);
      // Continue with submission even if API check fails, since we did client-side validation
      addNotification({
        type: "warning",
        title: "Conflict Check Unavailable",
        message:
          "Unable to verify conflicts with server. Proceeding with client-side validation only.",
      });
    }
    setCheckingConflicts(false);

    // No conflicts, proceed with submission
    setSubmitting(true);
    try {
      let response;
      if (editingSchedule) {
        response = await api.updateSchedule(
          editingSchedule.id,
          newScheduleData,
        );
      } else {
        response = await api.createSchedule(newScheduleData);
      }

      if (response.success) {
        addNotification({
          type: "success",
          title: editingSchedule ? "Schedule Updated" : "Schedule Added",
          message: `Schedule has been successfully ${
            editingSchedule ? "updated" : "created"
          }!`,
        });
        fetchSchedules();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Save Failed",
          message:
            response.message ||
            `Failed to ${editingSchedule ? "update" : "create"} schedule`,
        });
      }
    } catch (error) {
      console.error(
        `Failed to ${editingSchedule ? "update" : "create"} schedule:`,
        error,
      );
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
      academicYear: getDefaultAcademicYear(),
    });
    setEditingSchedule(null);
    setShowAddForm(false);
  };

  const startEdit = (schedule: Schedule) => {
    setFormData({
      subjectId: schedule.subjectId.toString(),
      classroomId: schedule.classroomId.toString(),
      facultyId: schedule.facultyId.toString(),
      dayOfWeek: schedule.dayOfWeek.toString(),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      semester: schedule.semester,
      academicYear: schedule.academicYear,
    });
    setEditingSchedule(schedule);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this schedule? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await api.deleteSchedule(id);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Schedule Deleted",
          message: "Schedule has been successfully removed.",
        });
        fetchSchedules();
      } else {
        addNotification({
          type: "error",
          title: "Delete Failed",
          message: response.message || "Failed to delete schedule",
        });
      }
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to delete schedule. Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getSchedulesForDay = (dayOfWeek: number) => {
    return schedules.filter((schedule) => schedule.dayOfWeek === dayOfWeek);
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
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

  // Calendar utility functions
  const getSchedulesForDate = (date: Date) => {
    const dayOfWeek = date.getDay();
    return schedules.filter((schedule) => schedule.dayOfWeek === dayOfWeek);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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
          {/* View Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 text-sm font-medium rounded ${
                viewMode === "grid"
                  ? "bg-cyan-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1 text-sm font-medium rounded ${
                viewMode === "calendar"
                  ? "bg-cyan-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Calendar View
            </button>
          </div>

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
            {editingSchedule ? "Edit Schedule" : "Add New Schedule"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="schedule-subject" className="block text-sm font-medium text-gray-300 mb-1">
                  Subject *
                </label>
                <select
                  id="schedule-subject"
                  name="subjectId"
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
                <label htmlFor="schedule-classroom" className="block text-sm font-medium text-gray-300 mb-1">
                  Classroom *
                </label>
                <select
                  id="schedule-classroom"
                  name="classroomId"
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
                <label htmlFor="schedule-faculty" className="block text-sm font-medium text-gray-300 mb-1">
                  Faculty *
                </label>
                <select
                  id="schedule-faculty"
                  name="facultyId"
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
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="schedule-day-of-week" className="block text-sm font-medium text-gray-300 mb-1">
                  Day of Week *
                </label>
                <select
                  id="schedule-day-of-week"
                  name="dayOfWeek"
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
                <label htmlFor="schedule-start-time" className="block text-sm font-medium text-gray-300 mb-1">
                  Start Time *
                </label>
                <input
                  id="schedule-start-time"
                  name="startTime"
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
                <label htmlFor="schedule-end-time" className="block text-sm font-medium text-gray-300 mb-1">
                  End Time *
                </label>
                <input
                  id="schedule-end-time"
                  name="endTime"
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
                <label htmlFor="schedule-semester" className="block text-sm font-medium text-gray-300 mb-1">
                  Semester *
                </label>
                <select
                  id="schedule-semester"
                  name="semester"
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
                <label htmlFor="schedule-academic-year" className="block text-sm font-medium text-gray-300 mb-1">
                  Academic Year *
                </label>
                <input
                  id="schedule-academic-year"
                  name="academicYear"
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

            {/* Conflicts Display */}
            {conflicts.length > 0 && (
              <div className="bg-red-900 border border-red-700 rounded-md p-4">
                <h5 className="text-red-300 font-medium mb-2">
                  Schedule Conflicts Detected:
                </h5>
                <ul className="space-y-1">
                  {conflicts.map((conflict: any, index: number) => (
                    <li key={index} className="text-red-200 text-sm">
                      • {conflict.message}
                    </li>
                  ))}
                </ul>
                <p className="text-red-300 text-sm mt-2">
                  Please adjust the schedule details to resolve these conflicts.
                </p>
              </div>
            )}

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
                loading={submitting || checkingConflicts}
                loadingText={
                  checkingConflicts
                    ? "Checking conflicts..."
                    : editingSchedule
                      ? "Updating..."
                      : "Adding..."
                }
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {editingSchedule ? "Update" : "Add"} Schedule
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Schedule Views */}
      {viewMode === "grid" ? (
        /* Grid View - Current Week Schedule */
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
                          schedule.startTime.split(":")[0],
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
      ) : (
        /* Calendar View */
        <div className="bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-lg font-medium text-white">
                  Monthly Calendar View
                </h4>
                <p className="text-sm text-gray-300">
                  Click on a date to view schedules for that day
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth("prev")}
                  className="text-gray-400 hover:text-white p-1"
                >
                  ‹
                </button>
                <span className="text-white font-medium">
                  {currentDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => navigateMonth("next")}
                  className="text-gray-400 hover:text-white p-1"
                >
                  ›
                </button>
                <button
                  onClick={goToToday}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded text-sm"
                >
                  Today
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-gray-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((date, index) => {
                if (!date) {
                  return <div key={index} className="p-2"></div>;
                }

                const daySchedules = getSchedulesForDate(date);
                const isToday =
                  date.toDateString() === new Date().toDateString();
                const isSelected =
                  selectedDate?.toDateString() === date.toDateString();

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-24 p-2 border rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-cyan-900 border-cyan-600"
                        : isToday
                          ? "bg-gray-700 border-gray-600"
                          : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isToday ? "text-cyan-400" : "text-white"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className="bg-cyan-800 border border-cyan-700 rounded px-1 py-0.5 text-xs text-cyan-200 truncate"
                          title={`${schedule.subjectName} - ${
                            schedule.classroomName
                          } (${formatTime(schedule.startTime)})`}
                        >
                          {schedule.subjectName}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-xs text-gray-400">
                          +{daySchedules.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details */}
          {selectedDate && (
            <div className="px-6 pb-6 border-t border-gray-700">
              <h5 className="text-lg font-medium text-white mb-4">
                Schedules for{" "}
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h5>
              <div className="space-y-3">
                {getSchedulesForDate(selectedDate).map((schedule) => (
                  <div
                    key={schedule.id}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h6 className="text-lg font-medium text-cyan-400">
                          {schedule.subjectName}
                        </h6>
                        <p className="text-gray-300">
                          {schedule.classroomName}
                        </p>
                        <p className="text-gray-300">{schedule.facultyName}</p>
                        <p className="text-sm text-gray-400">
                          {formatTime(schedule.startTime)} -{" "}
                          {formatTime(schedule.endTime)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {schedule.semester} {schedule.academicYear}
                        </p>
                      </div>
                      {user?.role === "admin" && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEdit(schedule)}
                            className="text-cyan-400 hover:text-cyan-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            disabled={deletingId === schedule.id}
                            className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed text-sm"
                          >
                            {deletingId === schedule.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {getSchedulesForDate(selectedDate).length === 0 && (
                  <p className="text-gray-400 text-center py-8">
                    No schedules for this date
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                {user?.role === "admin" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
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
                  {user?.role === "admin" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(schedule)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deletingId === schedule.id}
                        className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                      >
                        {deletingId === schedule.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  )}
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
