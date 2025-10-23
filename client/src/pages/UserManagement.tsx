import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: Partial<User>) => {
    try {
      await api.post("/users", userData);
      loadUsers();
      setShowCreateForm(false);
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    try {
      await api.put(`/users/${userId}`, userData);
      loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error("Failed to update user:", error);
    }
  };

  const handleSoftDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      await api.delete(`/users/${userId}/soft`);
      loadUsers();
    } catch (error) {
      console.error("Failed to deactivate user:", error);
    }
  };

  const handleHardDelete = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this user? This action cannot be undone."
      )
    )
      return;

    try {
      await api.delete(`/users/${userId}/hard`);
      loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/reset-password`);
      alert("Password reset email sent successfully");
    } catch (error) {
      console.error("Failed to reset password:", error);
    }
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
                    onClick={() => setEditingUser(user)}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleSoftDelete(user.id)}
                    className="text-yellow-400 hover:text-yellow-300"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleHardDelete(user.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit User Modal would go here */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create New User
            </h3>
            {/* Form implementation */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
