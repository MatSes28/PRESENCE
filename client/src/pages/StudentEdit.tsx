import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import { useLocation, useRoute } from "wouter";
import { Link } from "wouter";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";

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

export const StudentEdit = () => {
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/students/:id/edit");
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    email: "",
    rfidUid: "",
    parentEmail: "",
    year: "",
    section: "",
    isActive: true,
  });

  // Form validation hooks
  const studentValidation = useFormValidation({
    studentId: commonValidationRules.studentId,
    name: commonValidationRules.name,
    email: { ...commonValidationRules.email, required: false },
    parentEmail: commonValidationRules.email,
  });

  useEffect(() => {
    if (match && params?.id) {
      fetchStudentData(parseInt(params.id));
    }
  }, [match, params?.id]);

  const fetchStudentData = async (studentId: number) => {
    try {
      setLoading(true);
      const response = await api.getStudent(studentId);
      if (response.success) {
        const studentData = response.data as Student;
        setStudent(studentData);
        setFormData({
          studentId: studentData.studentId,
          name: studentData.name,
          email: studentData.email || "",
          rfidUid: studentData.rfidUid || "",
          parentEmail: studentData.parentEmail,
          year: studentData.year ? studentData.year.toString() : "",
          section: studentData.section || "",
          isActive: studentData.isActive,
        });
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Student",
          message: response.message || "Unable to fetch student data",
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Extract only string fields for validation
    const validationData = {
      studentId: formData.studentId,
      name: formData.name,
      email: formData.email,
      parentEmail: formData.parentEmail,
    };

    if (!studentValidation.validateForm(validationData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.updateStudent(student!.id, formData);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Updated",
          message: "Student updated successfully!",
        });
        setLocation(`/students/${student!.id}`);
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update student",
        });
      }
    } catch (error) {
      console.error("Failed to update student:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to update student. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
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
          <h3 className="text-lg font-medium text-white">Edit Student</h3>
          <p className="text-sm text-gray-300">
            Update student information and RFID assignments
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href={`/students/${student.id}`}>
            <a className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Cancel
            </a>
          </Link>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-edit-student-id" className="block text-sm font-medium text-gray-300 mb-1">
                Student ID *
              </label>
              <input
                id="student-edit-student-id"
                name="studentId"
                type="text"
                value={formData.studentId}
                onChange={(e) => {
                  setFormData({ ...formData, studentId: e.target.value });
                  studentValidation.validateSingleField(
                    "studentId",
                    e.target.value,
                  );
                  studentValidation.setFieldTouched("studentId");
                }}
                className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  studentValidation.getFieldError("studentId")
                    ? "border-red-500"
                    : "border-gray-600"
                }`}
                placeholder="e.g., 2021001"
              />
              {studentValidation.getFieldError("studentId") && (
                <p className="text-red-400 text-sm mt-1">
                  {studentValidation.getFieldError("studentId")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="student-edit-name" className="block text-sm font-medium text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                id="student-edit-name"
                name="name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  studentValidation.validateSingleField("name", e.target.value);
                  studentValidation.setFieldTouched("name");
                }}
                className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  studentValidation.getFieldError("name")
                    ? "border-red-500"
                    : "border-gray-600"
                }`}
                placeholder="Enter full name"
              />
              {studentValidation.getFieldError("name") && (
                <p className="text-red-400 text-sm mt-1">
                  {studentValidation.getFieldError("name")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="student-edit-email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="student-edit-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  studentValidation.validateSingleField(
                    "email",
                    e.target.value,
                  );
                  studentValidation.setFieldTouched("email");
                }}
                className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  studentValidation.getFieldError("email")
                    ? "border-red-500"
                    : "border-gray-600"
                }`}
                placeholder="student@email.com"
              />
              {studentValidation.getFieldError("email") && (
                <p className="text-red-400 text-sm mt-1">
                  {studentValidation.getFieldError("email")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="student-edit-rfid" className="block text-sm font-medium text-gray-300 mb-1">
                RFID UID
              </label>
              <input
                id="student-edit-rfid"
                name="rfidUid"
                type="text"
                value={formData.rfidUid}
                onChange={(e) =>
                  setFormData({ ...formData, rfidUid: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="RFID card UID"
              />
              {formData.rfidUid && (
                <p className="text-xs text-gray-400 mt-1">
                  RFID cards must be unique across all students
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="student-edit-parent-email" className="block text-sm font-medium text-gray-300 mb-1">
                Parent Email *
              </label>
              <input
                id="student-edit-parent-email"
                name="parentEmail"
                type="email"
                autoComplete="email"
                value={formData.parentEmail}
                onChange={(e) => {
                  setFormData({ ...formData, parentEmail: e.target.value });
                  studentValidation.validateSingleField(
                    "parentEmail",
                    e.target.value,
                  );
                  studentValidation.setFieldTouched("parentEmail");
                }}
                className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  studentValidation.getFieldError("parentEmail")
                    ? "border-red-500"
                    : "border-gray-600"
                }`}
                placeholder="parent@email.com"
              />
              {studentValidation.getFieldError("parentEmail") && (
                <p className="text-red-400 text-sm mt-1">
                  {studentValidation.getFieldError("parentEmail")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="student-edit-year" className="block text-sm font-medium text-gray-300 mb-1">
                Year
              </label>
              <select
                id="student-edit-year"
                name="year"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="">Select Year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label htmlFor="student-edit-section" className="block text-sm font-medium text-gray-300 mb-1">
                Section
              </label>
              <select
                id="student-edit-section"
                name="section"
                value={formData.section}
                onChange={(e) =>
                  setFormData({ ...formData, section: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="">Select Section</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
            <div>
              <label htmlFor="student-edit-status" className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                id="student-edit-status"
                name="status"
                value={formData.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isActive: e.target.value === "active",
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <Link href={`/students/${student.id}`}>
              <a className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md">
                Cancel
              </a>
            </Link>
            <LoadingButton
              type="submit"
              loading={submitting}
              loadingText="Updating..."
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Update Student
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};
