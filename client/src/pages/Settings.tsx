import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

export const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [systemSettings, setSystemSettings] = useState({
    emailNotifications: true,
    darkMode: false,
    language: "en",
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.updateProfile(profileData);
      if (response.success) {
        setMessage("Profile updated successfully!");
      } else {
        setError(response.message || "Failed to update profile");
      }
    } catch (err) {
      setError("An error occurred while updating profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords don't match!");
      return;
    }

    setLoading(true);
    try {
      const response = await api.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.success) {
        setMessage("Password changed successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setError(response.message || "Failed to change password");
      }
    } catch (err) {
      setError("An error occurred while changing password");
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.updateUserSettings(systemSettings);
      if (response.success) {
        setMessage("Settings updated successfully!");
      } else {
        setError(response.message || "Failed to update settings");
      }
    } catch (err) {
      setError("An error occurred while updating settings");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "system", label: "System", icon: "⚙️" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Settings</h3>
        <p className="text-sm text-gray-500">
          Manage your account and system preferences
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Settings */}
          {activeTab === "profile" && (
            <div>
              <h4 className="text-lg font-medium mb-4">Profile Information</h4>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-600 text-sm">{message}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    {loading ? "Updating..." : "Update Profile"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div>
              <h4 className="text-lg font-medium mb-4">Change Password</h4>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-600 text-sm">{message}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    {loading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* System Settings */}
          {activeTab === "system" && (
            <div>
              <h4 className="text-lg font-medium mb-4">System Preferences</h4>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Dark Mode
                      </label>
                      <p className="text-sm text-gray-500">
                        Enable dark theme for the interface
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.darkMode}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          darkMode: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={systemSettings.language}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          language: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-600 text-sm">{message}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    {loading ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === "notifications" && (
            <div>
              <h4 className="text-lg font-medium mb-4">
                Notification Preferences
              </h4>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Email Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive email notifications for attendance events
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.emailNotifications}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          emailNotifications: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-600 text-sm">{message}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    {loading ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
