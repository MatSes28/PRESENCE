import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "faculty";
  createdAt: string;
  updatedAt: string;
}

export const FacultyManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "faculty" as "admin" | "faculty",
    password: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Check if current user is admin
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-400">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers((response.data as User[]) || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError("");
    setMessage("");

    try {
      if (editingUser) {
        const response = await api.updateUser(editingUser.id, {
          email: formData.email,
          name: formData.name,
          role: formData.role,
        });
        if (response.success) {
          setMessage("User updated successfully!");
        } else {
          setError(response.message || "Failed to update user");
        }
      } else {
        const response = await api.createUser(formData);
        if (response.success) {
          setMessage("User created successfully!");
        } else {
          setError(response.message || "Failed to create user");
        }
      }
      fetchUsers();
      resetForm();
    } catch (error) {
      setError("An error occurred while saving user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        const response = await api.deleteUser(id);
        if (response.success) {
          setMessage("User deleted successfully!");
          fetchUsers();
        } else {
          setError(response.message || "Failed to delete user");
        }
      } catch (error) {
        setError("An error occurred while deleting user");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      name: "",
      role: "faculty",
      password: "",
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const startEdit = (user: User) => {
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      password: "", // Don't populate password for security
    });
    setEditingUser(user);
    setShowAddForm(true);
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Faculty Management</h3>
          <p className="text-sm text-gray-300">
            Manage faculty and administrator accounts
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add User
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            {editingUser ? "Edit User" : "Add New User"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900 border border-red-700 rounded p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-900 border border-green-700 rounded p-3">
                <p className="text-green-400 text-sm">{message}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="user@clsu.edu.ph"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Role *
                </label>
                <select
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
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter password"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 rounded-lg"
              >
                {formLoading
                  ? "Saving..."
                  : (editingUser ? "Update" : "Add") + " User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Users ({users.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
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
                  Created
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-900 text-purple-300"
                          : "bg-blue-900 text-blue-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => startEdit(user)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Edit
                    </button>
                    {user.id !== 1 && ( // Don't allow deleting the main admin
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No users found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
