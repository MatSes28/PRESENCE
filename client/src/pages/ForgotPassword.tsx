import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post("/auth/forgot-password", { email });
      if (response.success) {
        setMessage("Password reset instructions have been sent to your email.");
      } else {
        setError(response.message || "Failed to send reset instructions.");
      }
    } catch (err: any) {
      setError(err?.data?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              Reset your password securely
            </p>
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">Secure password recovery</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Email verification required
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Contact administrator if needed
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-48 translate-x-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-300/10 rounded-full translate-y-32 -translate-x-32"></div>
      </div>

      {/* Right Panel - Forgot Password Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-teal-400 mb-2">
              Forgot Password
            </h2>
            <p className="text-gray-400">
              Enter your email address and we'll help you reset your password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Enter your email"
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-900/50 border border-green-500 rounded-lg p-3">
                <p className="text-green-400 text-sm">{message}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? "Sending..." : "Send Reset Instructions"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-teal-400 hover:text-teal-300 text-sm"
                onClick={() => setLocation("/login")}
              >
                ← Back to Login
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Contact your administrator if you need immediate assistance
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
