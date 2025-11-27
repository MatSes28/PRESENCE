import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { useAuth } from "../hooks/useAuth";

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  year?: number;
  section?: string;
  isEnrolled?: boolean;
}

interface Enrollment {
  id: number;
  studentId: number;
  subjectId: number;
  semester: string;
  academicYear: string;
}

export const Roster: React.FC = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [unenrolling, setUnenrolling] = useState<number | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadRoster();
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      const response = await api.get("/subjects");
      if (response.success) {
        setSubjects((response.data as Subject[]) || []);
      }
    } catch (error) {
      console.error("Failed to load subjects:", error);
      addNotification({
        type: "error",
        title: "Failed to Load Subjects",
        message: "Unable to fetch subjects data",
      });
    }
  };

  const loadRoster = async () => {
    if (!selectedSubject) return;

    setLoading(true);
    try {
      // Load enrolled students
      const enrolledResponse = await api.get(
        `/subjects/${selectedSubject}/students`
      );
      let enrolled: Student[] = [];
      if (enrolledResponse.success) {
        enrolled = ((enrolledResponse.data as Student[]) || []).map(
          (student: Student) => ({
            ...student,
            isEnrolled: true,
          })
        );
        setEnrolledStudents(enrolled);
      }

      // Load available students (not enrolled in this subject)
      const availableResponse = await api.get("/students");
      if (availableResponse.success) {
        const enrolledIds = new Set(enrolled.map((s) => s.id));
        const available = ((availableResponse.data as Student[]) || [])
          .filter((student: Student) => !enrolledIds.has(student.id))
          .map((student: Student) => ({
            ...student,
            isEnrolled: false,
          }));
        setAvailableStudents(available);
      }
    } catch (error) {
      console.error("Failed to load roster:", error);
      addNotification({
        type: "error",
        title: "Failed to Load Roster",
        message: "Unable to fetch roster data",
      });
    } finally {
      setLoading(false);
    }
  };

  const enrollStudent = async (studentId: number) => {
    if (!selectedSubject) return;

    setEnrolling(studentId);
    try {
      const response = await api.post(`/enrollments`, {
        studentId,
        subjectId: parseInt(selectedSubject),
        semester: "1st Semester", // Default
        academicYear: new Date().getFullYear().toString(),
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Enrolled",
          message: "Student has been successfully enrolled in the subject",
        });
        loadRoster(); // Reload roster
      } else {
        addNotification({
          type: "error",
          title: "Enrollment Failed",
          message: response.message || "Failed to enroll student",
        });
      }
    } catch (error) {
      console.error("Failed to enroll student:", error);
      addNotification({
        type: "error",
        title: "Enrollment Error",
        message: "Failed to enroll student. Please try again.",
      });
    } finally {
      setEnrolling(null);
    }
  };

  const unenrollStudent = async (studentId: number) => {
    if (!selectedSubject) return;

    if (
      !confirm(
        "Are you sure you want to unenroll this student from the subject?"
      )
    ) {
      return;
    }

    setUnenrolling(studentId);
    try {
      const response = await api.delete(
        `/enrollments/${studentId}/${selectedSubject}`
      );

      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Unenrolled",
          message: "Student has been successfully unenrolled from the subject",
        });
        loadRoster(); // Reload roster
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
        title: "Unenrollment Error",
        message: "Failed to unenroll student. Please try again.",
      });
    } finally {
      setUnenrolling(null);
    }
  };

  const bulkEnrollStudents = async (studentIds: number[]) => {
    if (!selectedSubject || studentIds.length === 0) return;

    try {
      const enrollments = studentIds.map((studentId) => ({
        studentId,
        subjectId: parseInt(selectedSubject),
        semester: "1st Semester",
        academicYear: new Date().getFullYear().toString(),
      }));

      const response = await api.post(`/enrollments/bulk`, { enrollments });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Bulk Enrollment Successful",
          message: `${
            (response.data as any)?.enrollments?.length || studentIds.length
          } students enrolled successfully`,
        });
        loadRoster();
        setShowEnrollModal(false);
      } else {
        addNotification({
          type: "error",
          title: "Bulk Enrollment Failed",
          message: response.message || "Failed to enroll students",
        });
      }
    } catch (error) {
      console.error("Bulk enrollment error:", error);
      addNotification({
        type: "error",
        title: "Bulk Enrollment Error",
        message: "Failed to enroll students. Please try again.",
      });
    }
  };

  const filteredAvailableStudents = availableStudents.filter(
    (student) =>
      searchTerm === "" ||
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageEnrollments = user?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">
            Class Roster Management
          </h3>
          <p className="text-sm text-gray-300">
            Manage student enrollments and view class rosters
          </p>
        </div>
        {canManageEnrollments && selectedSubject && (
          <button
            onClick={() => setShowEnrollModal(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Enroll Students
          </button>
        )}
      </div>

      {/* Subject Selector */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Choose a subject...</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
        </div>

        {/* Enrolled Students */}
        {selectedSubject && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-cyan-400 mb-4">
                Enrolled Students ({enrolledStudents.length})
              </h4>
              {loading ? (
                <div className="text-center py-8 text-gray-400">
                  Loading roster...
                </div>
              ) : enrolledStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No students enrolled in this subject
                </div>
              ) : (
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
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Section
                        </th>
                        {canManageEnrollments && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {enrolledStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {student.studentId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {student.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {student.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {student.year}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {student.section}
                          </td>
                          {canManageEnrollments && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => unenrollStudent(student.id)}
                                disabled={unenrolling === student.id}
                                className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                              >
                                {unenrolling === student.id
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print Button */}
            {enrolledStudents.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Print Class List
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enroll Students Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Enroll Students in{" "}
              {subjects.find((s) => s.id.toString() === selectedSubject)?.name}
            </h3>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search students..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
              />
            </div>

            {/* Available Students */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAvailableStudents.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  {availableStudents.length === 0
                    ? "No available students"
                    : "No students match your search"}
                </p>
              ) : (
                filteredAvailableStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between bg-gray-700 p-3 rounded"
                  >
                    <div>
                      <div className="text-white font-medium">
                        {student.name}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {student.studentId}
                      </div>
                    </div>
                    <button
                      onClick={() => enrollStudent(student.id)}
                      disabled={enrolling === student.id}
                      className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-3 py-1 rounded text-sm"
                    >
                      {enrolling === student.id ? "Enrolling..." : "Enroll"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
