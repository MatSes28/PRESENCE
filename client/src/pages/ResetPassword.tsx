import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { api } from "../lib/api";

export const ResetPassword = () => {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const searchParams = useSearch();

  // Password match validation
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    // Get token and email from URL
    const params = new URLSearchParams(searchParams);
    const tokenParam = params.get("token");
    const emailParam = params.get("email");
    if (tokenParam) {
      setToken(tokenParam);
    }
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setLoading(true);

    try {
      const response = await api.resetPassword(
        token,
        email,
        newPassword,
        confirmPassword,
      );

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          setLocation("/");
        }, 3000);
      } else {
        setError(response.message || "Failed to reset password");
      }
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || "Failed to reset password. Please try again.";
      if (errorMessage.includes("expired")) {
        setError(
          "This reset link has expired. Please request a new password reset.",
        );
      } else if (errorMessage.includes("Invalid or expired")) {
        setError(
          "Invalid or expired reset link. Please request a new password reset.",
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Same as Login */}
        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
            <div className="max-w-md text-center">
              <h1 className="text-5xl font-bold mb-4 text-teal-100">
                CLIRDEC:PRESENCE
              </h1>
              <p className="text-xl mb-8 text-cyan-100">
                Password successfully reset
              </p>
              <div className="space-y-4 text-left">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                  <span className="text-cyan-100">Secure password updated</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                  <span className="text-cyan-100">Ready to log in</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                  <span className="text-cyan-100">Redirecting to login</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-48 translate-x-48"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-300/10 rounded-full translate-y-32 -translate-x-32"></div>
        </div>

        {/* Right Panel - Success Message */}
        <div className="flex-1 flex items-center justify-center bg-gray-900 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-teal-400 mb-2">
                Password Reset Successful!
              </h2>
              <p className="text-gray-400">
                Your password has been updated successfully. Redirecting to
                login...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Same as Login */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-md text-center">
            <h1 className="text-5xl font-bold mb-4 text-teal-100">
              CLIRDEC:PRESENCE
            </h1>
            <p className="text-xl mb-8 text-cyan-100">Secure password reset</p>
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Strong password requirements
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">Secure token validation</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Encrypted password storage
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-48 translate-x-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-300/10 rounded-full translate-y-32 -translate-x-32"></div>
      </div>

      {/* Right Panel - Reset Password Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-teal-400 mb-2">
              Reset Password
            </h2>
            <p className="text-gray-400">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                  placeholder="Enter new password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be 8+ characters with uppercase, lowercase, and number
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                  placeholder="Confirm new password"
                />
                {/* Password Match Indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    {passwordsMatch ? (
                      <div className="flex items-center gap-1 text-green-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>Passwords match</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        <span>Passwords do not match</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Resetting...
                  </div>
                ) : (
                  "Reset Password"
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-teal-400 hover:text-teal-300 text-sm"
                onClick={() => setLocation("/")}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

