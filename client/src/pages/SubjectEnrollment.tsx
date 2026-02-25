import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  year?: number;
  section?: string;
}

interface Subject {
  id: number;
  code: string;
  name: string;
  description?: string;
}

interface Enrollment {
  id: number;
  studentId: number;
  subjectId: number;
  semester: string;
  academicYear: string;
  enrolledAt: string;
  isActive: boolean;
  student?: Student;
  subject?: Subject;
}

export const SubjectEnrollment = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2023-2024");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchSubjectEnrollments(selectedSubject);
    }
  }, [selectedSubject]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch subjects and students in parallel
      const [subjectsResponse, studentsResponse] = await Promise.all([
        api.getSubjects(),
        api.getStudents(),
      ]);

      if (subjectsResponse.success) {
        setSubjects(subjectsResponse.data as Subject[]);
      }

      if (studentsResponse.success) {
        setStudents(studentsResponse.data as Student[]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
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

  const fetchSubjectEnrollments = async (subjectId: number) => {
    try {
      const response = await api.getSubjectStudents(subjectId);
      if (response.success) {
        setEnrollments(response.data as Enrollment[]);
      }
    } catch (error) {
      console.error("Failed to fetch subject enrollments:", error);
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to fetch enrollments for this subject.",
      });
    }
  };

  const handleEnrollStudents = async () => {
    if (!selectedSubject || selectedStudents.length === 0) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please select a subject and at least one student.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.bulkEnrollStudents({
        studentIds: selectedStudents,
        subjectId: selectedSubject,
        semester,
        academicYear,
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Enrollment Successful",
          message: `${selectedStudents.length} students enrolled successfully!`,
        });
        fetchSubjectEnrollments(selectedSubject);
        setSelectedStudents([]);
        setShowEnrollForm(false);
      } else {
        // Handle specific error cases
        if (response.message && response.message.includes("already enrolled")) {
          addNotification({
            type: "error",
            title: "Enrollment Failed",
            message: response.message,
          });
          // Remove already enrolled students from selection
          const alreadyEnrolled = (response as any).alreadyEnrolled as
            | number[]
            | undefined;
          if (alreadyEnrolled) {
            setSelectedStudents((prev) =>
              prev.filter((id) => !alreadyEnrolled.includes(id)),
            );
          }
        } else {
          addNotification({
            type: "error",
            title: "Enrollment Failed",
            message:
              response.message ||
              "Failed to enroll students. Please try again.",
          });
        }
      }
    } catch (error) {
      console.error("Failed to enroll students:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to enroll students. Please check your connection.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnenrollStudent = async (studentId: number) => {
    if (!selectedSubject) return;

    if (
      !confirm(
        "Are you sure you want to unenroll this student from this subject?",
      )
    ) {
      return;
    }

    try {
      const response = await api.unenrollStudent(studentId, selectedSubject);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Unenrollment Successful",
          message: "Student has been unenrolled successfully.",
        });
        fetchSubjectEnrollments(selectedSubject);
      } else {
        addNotification({
          type: "error",
          title: "Unenrollment Failed",
          message: response.message || "Failed to unenroll student.",
        });
      }
    } catch (error) {
      console.error("Failed to unenroll student:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to unenroll student. Please check your connection.",
      });
    }
  };

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const filteredStudents = students.filter((student) => {
    const search = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(search) ||
      student.studentId.toLowerCase().includes(search)
    );
  });

  const enrolledStudentIds = enrollments.map((e) => e.studentId);
  const availableStudents = filteredStudents.filter(
    (student) => !enrolledStudentIds.includes(student.id),
  );

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
          <h3 className="text-lg font-medium text-white">
            Subject Enrollment Management
          </h3>
          <p className="text-sm text-gray-300">
            Manage student enrollments in subjects
          </p>
        </div>
      </div>

      {/* Subject Selection */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Select Subject
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={selectedSubject || ""}
            onChange={(e) =>
              setSelectedSubject(parseInt(e.target.value) || null)
            }
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
          >
            <option value="">Select a subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
          >
            <option value="1st Semester">1st Semester</option>
            <option value="2nd Semester">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>

          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
          >
            <option value="2023-2024">2023-2024</option>
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
          </select>
        </div>
      </div>

      {selectedSubject && (
        <>
          {/* Enrollment Actions */}
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-medium text-white">
              Enrolled Students ({enrollments.length})
            </h4>
            {user?.role === "admin" && (
              <button
                onClick={() => setShowEnrollForm(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Enroll Students
              </button>
            )}
          </div>

          {/* Enrolled Students Table */}
          <div className="bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Year & Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Enrollment Date
                    </th>
                    {user?.role === "admin" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {enrollments.length > 0 ? (
                    enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {enrollment.student?.studentId || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-sm text-white">
                                {enrollment.student?.name.charAt(0) || ""}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-white">
                                {enrollment.student?.name || "Unknown"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {enrollment.student?.year
                            ? `Year ${enrollment.student.year}`
                            : "N/A"}
                          {enrollment.student?.section
                            ? `, Section ${enrollment.student.section}`
                            : ""}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </td>
                        {user?.role === "admin" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() =>
                                handleUnenrollStudent(enrollment.studentId)
                              }
                              className="text-red-400 hover:text-red-300"
                            >
                              Unenroll
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={user?.role === "admin" ? 5 : 4}
                        className="text-center py-8"
                      >
                        <p className="text-gray-400">
                          No students enrolled in this subject yet.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enroll Students Form */}
          {showEnrollForm && (
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
                Enroll Students
              </h4>

              {/* Search Students */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search students by name or ID"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
              </div>

              {/* Available Students */}
              <div className="mb-4">
                <h5 className="text-md font-medium text-gray-300 mb-2">
                  Available Students ({availableStudents.length})
                </h5>
                <div className="max-h-64 overflow-y-auto border border-gray-600 rounded-md">
                  {availableStudents.length > 0 ? (
                    availableStudents.map((student) => (
                      <div
                        key={student.id}
                        className={`p-2 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
                          selectedStudents.includes(student.id)
                            ? "bg-gray-700"
                            : ""
                        }`}
                        onClick={() => toggleStudentSelection(student.id)}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="mr-2"
                          />
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm text-white">
                              {student.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">
                              {student.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {student.studentId} -{" "}
                              {student.year ? `Year ${student.year}` : ""}
                              {student.section
                                ? `, Section ${student.section}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-400">
                      No available students to enroll.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-gray-300">
                  Selected: {selectedStudents.length} students
                </p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEnrollForm(false)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={handleEnrollStudents}
                    loading={submitting}
                    loadingText="Enrolling..."
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
                    disabled={selectedStudents.length === 0 || submitting}
                  >
                    Enroll Selected Students
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!selectedSubject && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            Please select a subject to view and manage enrollments.
          </p>
        </div>
      )}
    </div>
  );
};
