import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "faculty";
  facultyId?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "faculty" as "admin" | "faculty",
    facultyId: "",
    department: "Information Technology",
    gender: "",
  });

  // Form validation hooks
  const userValidation = useFormValidation({
    name: commonValidationRules.name,
    email: commonValidationRules.email,
    password: editingUser
      ? { required: false }
      : commonValidationRules.password,
    confirmPassword: editingUser
      ? { required: false }
      : {
          ...commonValidationRules.password,
          custom: (value) => {
            if (value !== formData.password) {
              return "Passwords do not match";
            }
            return "";
          },
        },
    facultyId: {
      required: formData.role === "faculty",
      minLength: 3,
      pattern: /^[A-Z0-9]+$/,
    },
  });

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      if (response.success) {
        const raw = (response as any)?.data;
        setUsers(Array.isArray(raw) ? (raw as User[]) : []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Users",
          message: response.message || "Unable to fetch user data",
        });
        setUsers([]);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userValidation.validateForm(formData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    setSubmitting(true);
    try {
      const userData = editingUser
        ? {
            email: formData.email,
            name: formData.name,
            role: formData.role,
            facultyId: formData.facultyId || undefined,
            department: formData.department || undefined,
            gender: formData.gender || undefined,
          }
        : {
            email: formData.email,
            name: formData.name,
            password: formData.password,
            role: formData.role,
            facultyId: formData.facultyId || undefined,
            department: formData.department || undefined,
            gender: formData.gender || undefined,
          };

      const response = editingUser
        ? await api.updateUser(parseInt(editingUser.id), userData as any)
        : await api.createUser(userData as any);

      if (response.success) {
        addNotification({
          type: "success",
          title: editingUser ? "User Updated" : "User Created",
          message: `User has been successfully ${
            editingUser ? "updated" : "created"
          }!`,
        });
        loadUsers();
        resetForm();
      } else {
        addNotification({
          type: "error",
          title: "Save Failed",
          message:
            response.message ||
            `Failed to ${editingUser ? "update" : "create"} user`,
        });
      }
    } catch (error) {
      console.error(
        `Failed to ${editingUser ? "update" : "create"} user:`,
        error
      );
      addNotification({
        type: "error",
        title: "Network Error",
        message: `Failed to ${
          editingUser ? "update" : "create"
        } user. Please check your connection and try again.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(userId);
    try {
      const response = await api.deleteUser(parseInt(userId));
      if (response.success) {
        addNotification({
          type: "success",
          title: "User Deleted",
          message: "User has been successfully removed from the system.",
        });
        loadUsers();
      } else {
        addNotification({
          type: "error",
          title: "Delete Failed",
          message: response.message || "Failed to delete user",
        });
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to delete user. Please check your connection and try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "faculty",
      facultyId: "",
      department: "Information Technology",
      gender: "",
    });
    setEditingUser(null);
    setShowCreateForm(false);
    userValidation.clearErrors();
  };

  const startEdit = (user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      confirmPassword: "",
      role: user.role,
      facultyId: user.facultyId || "",
      department: user.department || "Information Technology",
      gender: (user as any).gender || "",
    });
    setEditingUser(user);
    setShowCreateForm(true);
    userValidation.clearErrors();
  };

  if (user?.role !== "admin") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
        <p className="text-gray-400">
          You don't have permission to access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
        >
          Add New User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === "admin"
                        ? "bg-purple-900 text-purple-300"
                        : "bg-blue-900 text-blue-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {user.department || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.isActive
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 space-x-2">
                  <button
                    onClick={() => startEdit(user)}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    disabled={deleting === user.id}
                    className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                  >
                    {deleting === user.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-cyan-400 mb-6">
              {editingUser ? "Edit User" : "Create New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="user-form-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  id="user-form-name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter full name"
                />
                {userValidation.errors.name && (
                  <p className="text-red-400 text-xs mt-1">
                    {userValidation.errors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="user-form-email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  id="user-form-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter email address"
                />
                {userValidation.errors.email && (
                  <p className="text-red-400 text-xs mt-1">
                    {userValidation.errors.email}
                  </p>
                )}
              </div>

              {!editingUser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="user-form-password" className="block text-sm font-medium text-gray-300 mb-1">
                      Password *
                    </label>
                    <input
                      id="user-form-password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Enter password"
                    />
                    {userValidation.errors.password && (
                      <p className="text-red-400 text-xs mt-1">
                        {userValidation.errors.password}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="user-form-confirm-password" className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      id="user-form-confirm-password"
                      name="confirmPassword"
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Confirm password"
                    />
                    {userValidation.errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">
                        {userValidation.errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="user-form-role" className="block text-sm font-medium text-gray-300 mb-1">
                    Role *
                  </label>
                  <select
                    id="user-form-role"
                    name="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "admin" | "faculty",
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="user-form-gender" className="block text-sm font-medium text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    id="user-form-gender"
                    name="gender"
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {formData.role === "faculty" && (
                <div>
                  <label htmlFor="user-form-faculty-id" className="block text-sm font-medium text-gray-300 mb-1">
                    Faculty ID *
                  </label>
                  <input
                    id="user-form-faculty-id"
                    name="facultyId"
                    type="text"
                    required
                    value={formData.facultyId}
                    onChange={(e) =>
                      setFormData({ ...formData, facultyId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter faculty ID"
                  />
                  {userValidation.errors.facultyId && (
                    <p className="text-red-400 text-xs mt-1">
                      {userValidation.errors.facultyId}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="user-form-department" className="block text-sm font-medium text-gray-300 mb-1">
                  Department
                </label>
                <input
                  id="user-form-department"
                  name="department"
                  type="text"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter department"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
                  loadingText={editingUser ? "Updating..." : "Creating..."}
                  className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {editingUser ? "Update User" : "Create User"}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
