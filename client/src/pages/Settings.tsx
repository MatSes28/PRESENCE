import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";
import { api } from "../lib/api";

export const Settings = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState("profile");

  // Form validation hooks
  const profileValidation = useFormValidation({
    name: commonValidationRules.name,
    email: commonValidationRules.email,
  });

  const passwordValidation = useFormValidation({
    currentPassword: { required: true },
    newPassword: commonValidationRules.password,
    confirmPassword: commonValidationRules.confirmPassword("newPassword"),
  });

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
    lateThreshold: 15, // Default: 15 minutes as per paper
    absentThreshold: 60, // Default: 60% of class time as per paper
    emailNotifications: true,
    semester: "1st Semester",
    academicYear: new Date().getFullYear().toString(),
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profileValidation.validateForm(profileData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    try {
      const response = await api.updateProfile(profileData);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Profile Updated",
          message: "Your profile has been updated successfully!",
        });
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update profile",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message || "An error occurred while updating profile",
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.validateForm(passwordData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    try {
      const response = await api.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.success) {
        addNotification({
          type: "success",
          title: "Password Changed",
          message: "Your password has been changed successfully!",
        });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        passwordValidation.clearErrors();
      } else {
        addNotification({
          type: "error",
          title: "Password Change Failed",
          message: response.message || "Failed to change password",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message || "An error occurred while changing password",
      });
    }
  };

  const handleSystemSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await api.updateUserSettings({
        emailNotifications: systemSettings.emailNotifications,
        darkMode: false,
        language: "en",
      });
      if (response.success) {
        addNotification({
          type: "success",
          title: "System Settings Updated",
          message: "System settings have been updated successfully!",
        });
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update system settings",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message ||
          "An error occurred while updating system settings",
      });
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "system", label: "System", icon: "⚙️" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-white">Settings</h3>
        <p className="text-sm text-gray-300">
          Manage your profile and security settings
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
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
              <h4 className="text-lg font-medium text-white mb-4">
                Profile Information
              </h4>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          name: e.target.value,
                        });
                        profileValidation.validateSingleField(
                          "name",
                          e.target.value
                        );
                        profileValidation.setFieldTouched("name");
                      }}
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        profileValidation.getFieldError("name")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                    />
                    {profileValidation.getFieldError("name") && (
                      <p className="text-red-400 text-sm mt-1">
                        {profileValidation.getFieldError("name")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        });
                        profileValidation.validateSingleField(
                          "email",
                          e.target.value
                        );
                        profileValidation.setFieldTouched("email");
                      }}
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        profileValidation.getFieldError("email")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                    />
                    {profileValidation.getFieldError("email") && (
                      <p className="text-red-400 text-sm mt-1">
                        {profileValidation.getFieldError("email")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Update Profile
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                Change Password
              </h4>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      });
                      passwordValidation.validateSingleField(
                        "currentPassword",
                        e.target.value
                      );
                      passwordValidation.setFieldTouched("currentPassword");
                    }}
                    className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      passwordValidation.getFieldError("currentPassword")
                        ? "border-red-500"
                        : "border-gray-600"
                    }`}
                    required
                  />
                  {passwordValidation.getFieldError("currentPassword") && (
                    <p className="text-red-400 text-sm mt-1">
                      {passwordValidation.getFieldError("currentPassword")}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        });
                        passwordValidation.validateSingleField(
                          "newPassword",
                          e.target.value
                        );
                        passwordValidation.setFieldTouched("newPassword");
                      }}
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        passwordValidation.getFieldError("newPassword")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("newPassword") && (
                      <p className="text-red-400 text-sm mt-1">
                        {passwordValidation.getFieldError("newPassword")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        });
                        passwordValidation.validateSingleField(
                          "confirmPassword",
                          e.target.value
                        );
                        passwordValidation.setFieldTouched("confirmPassword");
                      }}
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        passwordValidation.getFieldError("confirmPassword")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("confirmPassword") && (
                      <p className="text-red-400 text-sm mt-1">
                        {passwordValidation.getFieldError("confirmPassword")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Change Password
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* System Settings */}
          {activeTab === "system" && user?.role === "admin" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                System Settings
              </h4>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Late Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={systemSettings.lateThreshold}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          lateThreshold: parseInt(e.target.value) || 15,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Default: 15 minutes (as per paper)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Absent Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={systemSettings.absentThreshold}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          absentThreshold: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Default: 60% of class time (as per paper)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Semester
                    </label>
                    <select
                      value={systemSettings.semester}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          semester: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                      <option value="Summer">Summer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={systemSettings.academicYear}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          academicYear: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="2024-2025"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={systemSettings.emailNotifications}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        emailNotifications: e.target.checked,
                      })
                    }
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                  />
                  <label className="ml-2 block text-sm text-white">
                    Enable email notifications for absences
                  </label>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Save System Settings
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
