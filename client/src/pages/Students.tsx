import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  rfidUid?: string;
  parentEmail?: string;
  createdAt: string;
}

export const Students = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("All Years");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [attendanceRates, setAttendanceRates] = useState<{
    [key: number]: number;
  }>({});
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    email: "",
    rfidUid: "",
    parentEmail: "",
    year: "",
    section: "",
  });

  // Form validation hooks - Make parent email mandatory
  const studentValidation = useFormValidation({
    studentId: commonValidationRules.studentId,
    name: commonValidationRules.name,
    email: { ...commonValidationRules.email, required: false },
    parentEmail: commonValidationRules.email, // Now required
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      fetchAttendanceRates();
    }
  }, [students]);

  const fetchStudents = async () => {
    try {
      const response = await api.getStudents();
      if (response.success) {
        setStudents((response.data as Student[]) || []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Students",
          message: response.message || "Unable to fetch student data",
        });
        setStudents([]);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRates = async () => {
    if (students.length === 0) return;

    try {
      const rates: { [key: number]: number } = {};

      // Fetch attendance data for each student (in a real app, you'd optimize this with a batch API)
      for (const student of students) {
        try {
          const response = await api.getStudentAttendance(student.id, {
            limit: 100,
          });
          if (response.success && (response.data as any)?.attendance) {
            const attendanceRecords = (response.data as any).attendance;
            const totalRecords = attendanceRecords.length;
            const presentRecords = attendanceRecords.filter(
              (record: any) => record.record?.status === "present"
            ).length;
            const attendanceRate =
              totalRecords > 0
                ? Math.round((presentRecords / totalRecords) * 100)
                : 0;
            rates[student.id] = attendanceRate;
          }
        } catch (error) {
          console.error(
            `Failed to fetch attendance for student ${student.id}:`,
            error
          );
          rates[student.id] = 0; // Default to 0 if fetch fails
        }
      }

      setAttendanceRates(rates);
    } catch (error) {
      console.error("Failed to fetch attendance rates:", error);
    }
  };

  // RFID uniqueness validation
  const validateRfidUniqueness = async (
    rfidUid: string,
    excludeStudentId?: number
  ): Promise<boolean> => {
    if (!rfidUid.trim()) return true; // Empty RFID is allowed

    try {
      // Check if any existing student has this RFID UID
      const existingStudent = students.find(
        (student) =>
          student.rfidUid === rfidUid.trim() && student.id !== excludeStudentId
      );

      return !existingStudent;
    } catch (error) {
      console.error("Failed to validate RFID uniqueness:", error);
      // If we can't validate, allow it but show a warning
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentValidation.validateForm(formData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    // Additional RFID uniqueness validation
    if (formData.rfidUid.trim()) {
      const isRfidUnique = await validateRfidUniqueness(
        formData.rfidUid,
        editingStudent?.id
      );
      if (!isRfidUnique) {
        addNotification({
          type: "error",
          title: "RFID Validation Error",
          message:
            "This RFID card is already assigned to another student. Please use a different card.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let response: any;
      if (editingStudent) {
        response = await api.updateStudent(editingStudent.id, formData);
      } else {
        response = await api.createStudent(formData);
      }

      if (response.success) {
        addNotification({
          type: "success",
          title: editingStudent ? "Student Updated" : "Student Added",
          message: `Student ${
            editingStudent ? "updated" : "added"
          } successfully!`,
        });
        fetchStudents();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Save Failed",
          message: response.message || "Failed to save student",
        });
      }
    } catch (error) {
      console.error("Failed to save student:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to save student. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this student? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(id);
    try {
      const response = await api.deleteStudent(id);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Deleted",
          message: "Student has been successfully removed from the system.",
        });
        fetchStudents();
      } else {
        addNotification({
          type: "error",
          title: "Delete Failed",
          message: response.message || "Failed to delete student",
        });
      }
    } catch (error) {
      console.error("Failed to delete student:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to delete student. Please check your connection and try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: "",
      name: "",
      email: "",
      rfidUid: "",
      parentEmail: "",
      year: "",
      section: "",
    });
    setEditingStudent(null);
    setShowAddForm(false);
    studentValidation.clearErrors();
  };

  const startEdit = (student: Student) => {
    setFormData({
      studentId: student.studentId,
      name: student.name,
      email: student.email || "",
      rfidUid: student.rfidUid || "",
      parentEmail: student.parentEmail || "",
      year: (student as any).year || "",
      section: (student as any).section || "",
    });
    setEditingStudent(student);
    setShowAddForm(true);
    studentValidation.clearErrors();
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

      const response = await fetch("/api/students/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: "success",
          title: "CSV Upload Successful",
          message: `Successfully imported ${result.imported} students${
            result.errors > 0 ? `, ${result.errors} errors` : ""
          }`,
        });
        fetchStudents();
      } else {
        addNotification({
          type: "error",
          title: "CSV Upload Failed",
          message: result.message || "Failed to import students from CSV",
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

  // Filter students based on search and filter criteria
  const filteredStudents = students.filter((student) => {
    // Search filter
    const matchesSearch =
      searchTerm === "" ||
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email &&
        student.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Year filter
    const matchesYear =
      yearFilter === "All Years" ||
      (student as any).year ===
        yearFilter
          .replace("st", "")
          .replace("nd", "")
          .replace("rd", "")
          .replace("th", "")
          .replace(" Year", "");

    // Section filter
    const matchesSection =
      sectionFilter === "All Sections" ||
      (student as any).section === sectionFilter.replace("Section ", "");

    return matchesSearch && matchesYear && matchesSection;
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
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Student Management</h3>
          <p className="text-sm text-gray-300">
            Manage student records and RFID assignments
          </p>
        </div>
        <div className="flex space-x-3">
          <label
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              uploadingCsv ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploadingCsv ? "Uploading..." : "Import CSV"}
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
              Add Student
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or ID"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Year
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option>All Years</option>
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
              <option>4th Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Section
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option>All Sections</option>
              <option>Section A</option>
              <option>Section B</option>
              <option>Section C</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setYearFilter("All Years");
                setSectionFilter("All Sections");
              }}
              className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            {editingStudent ? "Edit Student" : "Add New Student"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Student ID *
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => {
                    setFormData({ ...formData, studentId: e.target.value });
                    studentValidation.validateSingleField(
                      "studentId",
                      e.target.value
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
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    studentValidation.validateSingleField(
                      "name",
                      e.target.value
                    );
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
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    studentValidation.validateSingleField(
                      "email",
                      e.target.value
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
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  RFID UID
                </label>
                <input
                  type="text"
                  value={formData.rfidUid}
                  onChange={(e) =>
                    setFormData({ ...formData, rfidUid: e.target.value })
                  }
                  onBlur={async (e) => {
                    if (e.target.value.trim()) {
                      const isUnique = await validateRfidUniqueness(
                        e.target.value,
                        editingStudent?.id
                      );
                      if (!isUnique) {
                        addNotification({
                          type: "warning",
                          title: "RFID Already Assigned",
                          message:
                            "This RFID card is already assigned to another student.",
                        });
                      }
                    }
                  }}
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
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Parent Email *
                </label>
                <input
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => {
                    setFormData({ ...formData, parentEmail: e.target.value });
                    studentValidation.validateSingleField(
                      "parentEmail",
                      e.target.value
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
                loadingText={editingStudent ? "Updating..." : "Adding..."}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {editingStudent ? "Update" : "Add"} Student
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Students Table (Desktop) */}
      <div className="hidden md:block bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Students ({filteredStudents.length}
            {filteredStudents.length !== students.length
              ? ` of ${students.length}`
              : ""}
            )
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
                  RFID Card
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Parent Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Attendance Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-sm text-white">
                          {student.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-white">
                          {student.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.rfidUid
                          ? "bg-green-900 text-green-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      {student.rfidUid || "Not Assigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {student.parentEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${attendanceRates[student.id] || 0}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-300">
                        {attendanceRates[student.id] || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {user?.role === "admin" && (
                      <>
                        <button
                          onClick={() => startEdit(student)}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setLocation(`/students/${student.id}`)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          View
                        </button>
                        <button className="text-blue-400 hover:text-blue-300">
                          Contact
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          disabled={deleting === student.id}
                          className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                        >
                          {deleting === student.id ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {students.length === 0
                ? "No students found. Add your first student to get started."
                : "No students match your search criteria. Try adjusting your filters."}
            </p>
          </div>
        )}
      </div>

      {/* Students Cards (Mobile) */}
      <div className="md:hidden space-y-4">
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-lg text-white">
                    {student.name.charAt(0)}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-sm font-medium text-white">
                    {student.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {student.studentId}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${
                    student.rfidUid
                      ? "bg-green-900 text-green-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {student.rfidUid ? "RFID Assigned" : "No RFID"}
                </span>
                <div className="flex items-center">
                  <div className="w-12 bg-gray-700 rounded-full h-1.5 mr-2">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${attendanceRates[student.id] || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-300">
                    {attendanceRates[student.id] || 0}%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-xs text-gray-400">
                Parent: {student.parentEmail}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setLocation(`/students/${student.id}`)}
                  className="text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  View
                </button>
                <button className="text-blue-400 hover:text-blue-300 text-sm">
                  Contact
                </button>
                {user?.role === "admin" && (
                  <>
                    <button
                      onClick={() => startEdit(student)}
                      className="text-gray-400 hover:text-gray-300 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(student.id)}
                      disabled={deleting === student.id}
                      className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed text-sm"
                    >
                      {deleting === student.id ? "Deleting..." : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Cards (Bottom) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">👥</span>
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
              <span className="text-white text-lg">✅</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                Active Students
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {students.filter((s) => s.rfidUid).length}
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🎫</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300">
                With RFID Cards
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {students.filter((s) => s.rfidUid).length}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
