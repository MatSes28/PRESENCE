import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

interface Subject {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export const Subjects = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await api.getSubjects();
      if (response.success) {
        setSubjects((response.data as Subject[]) || []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Subjects",
          message: response.message || "Unable to fetch subject data",
        });
        setSubjects([]);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Subject code and name are required",
      });
      return;
    }

    setSubmitting(true);
    try {
      let response: any;
      if (editingSubject) {
        response = await api.updateSubject(editingSubject.id, formData);
      } else {
        response = await api.createSubject(formData);
      }

      if (response.success) {
        addNotification({
          type: "success",
          title: editingSubject ? "Subject Updated" : "Subject Created",
          message: `Subject ${
            editingSubject ? "updated" : "created"
          } successfully!`,
        });
        fetchSubjects();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Save Failed",
          message: response.message || "Failed to save subject",
        });
      }
    } catch (error) {
      console.error("Failed to save subject:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to save subject. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this subject? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(id);
    try {
      const response = await api.deleteSubject(id);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Subject Deleted",
          message: "Subject has been successfully removed from the system.",
        });
        fetchSubjects();
      } else {
        addNotification({
          type: "error",
          title: "Delete Failed",
          message: response.message || "Failed to delete subject",
        });
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to delete subject. Please check your connection and try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
    });
    setEditingSubject(null);
    setShowAddForm(false);
  };

  const startEdit = (subject: Subject) => {
    setFormData({
      code: subject.code,
      name: subject.name,
      description: subject.description || "",
    });
    setEditingSubject(subject);
    setShowAddForm(true);
  };

  const filteredSubjects = subjects.filter((subject) => {
    const search = searchTerm.toLowerCase();
    return (
      subject.name.toLowerCase().includes(search) ||
      subject.code.toLowerCase().includes(search) ||
      (subject.description &&
        subject.description.toLowerCase().includes(search))
    );
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
          <h3 className="text-lg font-medium text-white">Subject Management</h3>
          <p className="text-sm text-gray-300">
            Manage academic subjects and courses
          </p>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add Subject
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-medium text-cyan-400">Search Subjects</h4>
        </div>
        <div className="mt-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, code, or description"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            {editingSubject ? "Edit Subject" : "Add New Subject"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., CS101"
                  disabled={!!editingSubject}
                />
                {editingSubject && (
                  <p className="text-xs text-gray-400 mt-1">
                    Subject code cannot be changed
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., Introduction to Programming"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter subject description"
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
                loadingText={editingSubject ? "Updating..." : "Creating..."}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {editingSubject ? "Update" : "Create"} Subject
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Table */}
      <div className="bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Subjects ({filteredSubjects.length}
            {filteredSubjects.length !== subjects.length
              ? ` of ${subjects.length}`
              : ""}
            )
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                {user?.role === "admin" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredSubjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-cyan-400">
                      {subject.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-white">{subject.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-300">
                      {subject.description || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        subject.isActive
                          ? "bg-green-900 text-green-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      {subject.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {user?.role === "admin" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(subject)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(subject.id)}
                        disabled={deleting === subject.id}
                        className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                      >
                        {deleting === subject.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSubjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {subjects.length === 0
                ? "No subjects found. Add your first subject to get started."
                : "No subjects match your search criteria."}
            </p>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">📚</span>
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
    </div>
  );
};
