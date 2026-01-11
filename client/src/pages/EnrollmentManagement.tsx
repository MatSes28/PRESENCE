import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { useAuth } from "../hooks/useAuth";
import { LoadingButton } from "../components/LoadingSpinner";

interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  year?: string;
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
  student: Student;
  subject: Subject;
  semester: string;
  academicYear: string;
  enrolledAt: string;
}

export const EnrollmentManagement = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [formData, setFormData] = useState({
    studentId: "",
    subjectId: "",
    semester: "",
    academicYear: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch students
      const studentsResponse = await api.getStudents();
      if (studentsResponse.success) {
        setStudents(studentsResponse.data || []);
      }

      // Fetch subjects
      const subjectsResponse = await api.getSubjects();
      if (subjectsResponse.success) {
        setSubjects(subjectsResponse.data || []);
      }

      // Fetch enrollments
      const enrollmentsResponse = await api.getEnrollments();
      if (enrollmentsResponse.success) {
        const enrollmentsData = enrollmentsResponse.data || [];
        // Transform the data to match our Enrollment interface
        const transformedEnrollments = Array.isArray(enrollmentsData)
          ? enrollmentsData.map((enrollment) => ({
              ...enrollment,
              student: students.find((s) => s.id === enrollment.studentId) || {
                id: 0,
                studentId: "",
                name: "",
              },
              subject: subjects.find(
                (sub) => sub.id === enrollment.subjectId
              ) || { id: 0, code: "", name: "" },
            }))
          : [];
        setEnrollments(transformedEnrollments);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      addNotification({
        type: "error",
        title: "Data Fetch Error",
        message: "Failed to load students, subjects, or enrollments",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await api.createEnrollment({
        studentId: parseInt(formData.studentId),
        subjectId: parseInt(formData.subjectId),
        semester: formData.semester,
        academicYear: formData.academicYear,
      });
      if (response.success) {
        addNotification({
          type: "success",
          title: "Enrollment Successful",
          message: `Student enrolled in subject successfully!`,
        });
        fetchData();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Enrollment Failed",
          message: response.message || "Failed to create enrollment",
        });
      }
    } catch (error) {
      console.error("Failed to create enrollment:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnenroll = async (enrollmentId: number) => {
    if (
      !confirm(
        "Are you sure you want to unenroll this student from the subject?"
      )
    ) {
      return;
    }

    try {
      const response = await api.deleteEnrollment(enrollmentId);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Unenrollment Successful",
          message: "Student has been successfully unenrolled from the subject.",
        });
        fetchData();
      } else {
        addNotification({
          type: "error",
          title: "Unenrollment Failed",
          message: response.message || "Failed to unenroll student",
        });
      }
    } catch (error) {
      console.error("Failed to unenroll student:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: "",
      subjectId: "",
      semester: "",
      academicYear: "",
    });
    setSelectedStudent(null);
    setSelectedSubject(null);
    setShowEnrollForm(false);
  };

  const getCurrentSemester = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 || month <= 5 ? "2nd Semester" : "1st Semester";
  };

  const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  // Filter enrollments based on search and selected subject
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      searchTerm === "" ||
      enrollment.student.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      enrollment.student.studentId
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      enrollment.subject.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      enrollment.subject.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject =
      selectedSubject === null || enrollment.subjectId === selectedSubject;

    return matchesSearch && matchesSubject;
  });

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
            Enrollment Management
          </h3>
          <p className="text-sm text-gray-300">
            Manage student enrollment in subjects
          </p>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => {
              setShowEnrollForm(true);
              setFormData({
                studentId: "",
                subjectId: "",
                semester: getCurrentSemester(),
                academicYear: getCurrentAcademicYear(),
              });
            }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Enroll Student
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, ID, or subject"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Filter by Subject
            </label>
            <select
              value={selectedSubject || ""}
              onChange={(e) =>
                setSelectedSubject(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Enroll Form */}
      {showEnrollForm && (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            Enroll Student in Subject
          </h4>
          <form onSubmit={handleEnroll} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Student *
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData({ ...formData, studentId: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.studentId} - {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject *
                </label>
                <select
                  value={formData.subjectId}
                  onChange={(e) =>
                    setFormData({ ...formData, subjectId: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </option>
                  ))}
                </select>
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
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Semester</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Academic Year *
                </label>
                <select
                  value={formData.academicYear}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYear: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Academic Year</option>
                  <option value="2023-2024">2023-2024</option>
                  <option value="2024-2025">2024-2025</option>
                  <option value="2025-2026">2025-2026</option>
                  <option value="2026-2027">2026-2027</option>
                </select>
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
                loadingText="Enrolling..."
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Enroll Student
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Enrollments Table */}
      <div className="bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Current Enrollments ({filteredEnrollments.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Semester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Academic Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-sm text-white">
                          {enrollment.student.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-white">
                          {enrollment.student.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {enrollment.student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {enrollment.subject.code}
                    </div>
                    <div className="text-xs text-gray-400">
                      {enrollment.subject.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {enrollment.semester}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {enrollment.academicYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleUnenroll(enrollment.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Unenroll
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEnrollments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {enrollments.length === 0
                ? "No enrollments found. Start by enrolling students in subjects."
                : "No enrollments match your search criteria. Try adjusting your filters."}
            </p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📚</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Total Students
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {students.length}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🎓</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Total Subjects
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {subjects.length}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📋</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Total Enrollments
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {enrollments.length}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
