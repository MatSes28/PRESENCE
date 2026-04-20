import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import { Link } from "wouter";
import { formatYearLabel } from "../lib/studentSections";

interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  year?: number;
  section?: string;
  rfidUid?: string;
  parentEmail: string;
  parentName?: string;
  isActive: boolean;
  createdAt: string;
}

interface Enrollment {
  id: number;
  studentId: number;
  subjectId: number;
  semester: string;
  academicYear: string;
  enrolledAt: string;
  isActive: boolean;
  subject?: {
    id: number;
    code: string;
    name: string;
    description?: string;
  };
}

interface AttendanceRecord {
  id: number;
  studentId: number;
  classSessionId: number;
  entryTime?: string;
  exitTime?: string;
  status: string;
  rfidDetected: boolean;
  sensorDetected: boolean;
  isValid: boolean;
  discrepancyFlag: boolean;
  notes?: string;
  createdAt: string;
}

const formatDateValue = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString();
};

export const StudentDetail = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/students/:id");
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (match && params?.id) {
      fetchStudentData(parseInt(params.id));
    }
  }, [match, params?.id]);

  const fetchStudentData = async (studentId: number) => {
    try {
      setLoading(true);

      // Fetch student data, enrollments, and attendance in parallel
      const [studentResponse, enrollmentsResponse, attendanceResponse] =
        await Promise.all([
          api.getStudent(studentId),
          api.getEnrollmentsForStudent(studentId),
          api.getStudentAttendance(studentId, { limit: 50 }),
        ]);

      if (studentResponse.success) {
        setStudent(studentResponse.data as Student);
      }

      if (enrollmentsResponse.success) {
        const enrollmentsRaw = (enrollmentsResponse as { enrollments?: unknown[] })
          .enrollments;
        const source = Array.isArray(enrollmentsResponse.data)
          ? enrollmentsResponse.data
          : Array.isArray(enrollmentsRaw)
            ? enrollmentsRaw
            : [];
        const flattened: Enrollment[] = source.map((item: any) => ({
          id: item.enrollment?.id ?? item.id,
          studentId: item.enrollment?.studentId ?? item.studentId ?? studentId,
          subjectId: item.enrollment?.subjectId ?? item.subjectId,
          semester: item.enrollment?.semester ?? item.semester ?? "",
          academicYear:
            item.enrollment?.academicYear ?? item.academicYear ?? "",
          enrolledAt: item.enrollment?.enrolledAt ?? item.enrolledAt ?? "",
          isActive: item.enrollment?.isActive ?? item.isActive ?? true,
          subject: item.subject,
        }));
        setEnrollments(flattened);
      }

      if (attendanceResponse.success) {
        const attendanceData = attendanceResponse.data as any;
        // Endpoint may return either `{ attendance: AttendanceRecord[] }` or a raw array.
        setAttendanceRecords(
          attendanceData?.attendance ?? attendanceData ?? [],
        );
      }
    } catch (error) {
      console.error("Failed to fetch student data:", error);
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

  const handleSendMessage = async () => {
    if (!message.trim() || !student) return;

    setSendingMessage(true);
    try {
      const response = await api.contactParent(student.id, message);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Message Sent",
          message: "Your message has been sent to the parent successfully!",
        });
        setMessage("");
      } else {
        addNotification({
          type: "error",
          title: "Failed to Send Message",
          message: response.message || "Failed to send message to parent.",
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to send message. Please check your connection.",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Student not found.</p>
        <button
          onClick={() => setLocation("/students")}
          className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium"
        >
          Back to Students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Student Details</h3>
          <p className="text-sm text-gray-300">
            Comprehensive student information and records
          </p>
        </div>
        <div className="flex space-x-4">
          <Link href="/students">
            <a className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Back to List
            </a>
          </Link>
          {user?.role === "admin" && (
            <Link href={`/students/${student.id}/edit`}>
              <a className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Edit Student
              </a>
            </Link>
          )}
        </div>
      </div>

      {/* Student Profile Card */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-cyan-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl text-white font-bold">
                {student.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-1">
              {student.name}
            </h4>
            <p className="text-cyan-400 text-sm">
              Student ID: {student.studentId}
            </p>
            <div className="mt-4 flex space-x-2">
              <span
                className={`inline-flex items-center px-4 py-1 rounded-full text-sm font-medium ${
                  student.isActive
                    ? "bg-green-900 text-green-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {student.isActive ? "Active" : "Inactive"}
              </span>
              <span
                className={`inline-flex items-center px-4 py-1 rounded-full text-sm font-medium ${
                  student.rfidUid
                    ? "bg-blue-900 text-blue-300"
                    : "bg-gray-900 text-gray-300"
                }`}
              >
                {student.rfidUid ? "RFID Assigned" : "No RFID"}
              </span>
            </div>
          </div>

          {/* Contact Information */}
          <div className="md:col-span-2">
            <h5 className="text-lg font-medium text-cyan-400 mb-4">
              Contact Information
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Student Email</p>
                <p className="text-white">{student.email || "Not provided"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Parent Name</p>
                <p className="text-white">
                  {student.parentName || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Parent Email</p>
                <p className="text-white">{student.parentEmail}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">RFID UID</p>
                <p className="text-white">
                  {student.rfidUid || "Not assigned"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <h5 className="text-lg font-medium text-cyan-400 mb-4">
            Academic Information
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Program</p>
              <p className="text-white">
                Bachelor of Science in Information Technology
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Year Level</p>
              <p className="text-white">{formatYearLabel(student.year)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Section</p>
              <p className="text-white">{student.section || "Not specified"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Department</p>
              <p className="text-white">
                Department of Information Technology (DIT)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">College</p>
              <p className="text-white">College of Engineering</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Account Created</p>
              <p className="text-white">
                {formatDateValue(student.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Parent Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Contact Parent
        </h4>
        <div className="space-y-4">
          <div>
            <label htmlFor="student-detail-message" className="block text-sm font-medium text-gray-300 mb-1">
              Message to Parent
            </label>
            <textarea
              id="student-detail-message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={`Send a message to ${
                student.parentName || "the parent"
              } regarding ${
                student.name
              }'s academic progress, attendance, or other concerns.`}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex justify-end">
            <LoadingButton
              onClick={handleSendMessage}
              loading={sendingMessage}
              loadingText="Sending..."
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={!message.trim() || sendingMessage}
            >
              Send Message to Parent
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Subject Enrollments */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium text-cyan-400">
            Subject Enrollments ({enrollments.length})
          </h4>
          {user?.role === "admin" && (
            <Link href="/subject-enrollment">
              <a className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Manage Enrollments
              </a>
            </Link>
          )}
        </div>

        {enrollments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Subject Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Subject Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Academic Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Enrollment Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-cyan-400">
                        {enrollment.subject?.code || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {enrollment.subject?.name || "Unknown Subject"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {enrollment.semester}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {enrollment.academicYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDateValue(enrollment.enrolledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">
              This student is not currently enrolled in any subjects.
            </p>
          </div>
        )}
      </div>

      {/* Recent Attendance */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Recent Attendance Records ({attendanceRecords.length})
        </h4>

        {attendanceRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Entry Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Exit Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Detection Method
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDateValue(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {record.entryTime
                        ? new Date(record.entryTime).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {record.exitTime
                        ? new Date(record.exitTime).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === "present"
                            ? "bg-green-900 text-green-300"
                            : record.status === "late"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-red-900 text-red-300"
                        }`}
                      >
                        {record.status.charAt(0).toUpperCase() +
                          record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {record.rfidDetected && record.sensorDetected
                        ? "RFID + Sensor"
                        : record.rfidDetected
                          ? "RFID"
                          : record.sensorDetected
                            ? "Sensor"
                            : "Manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">
              No attendance records found for this student.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

