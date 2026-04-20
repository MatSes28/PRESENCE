import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { login, loading, error } = useAuth();
  const [, setLocation] = useLocation();

  // Clear success message when error occurs
  useEffect(() => {
    if (error) {
      setLoginSuccess(false);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSuccess(false); // Clear any previous success state

    const success = await login(email, password);

    if (success) {
      setLoginSuccess(true);
      // Redirect to dashboard after successful login
      setTimeout(() => {
        setLocation("/");
      }, 1000); // Small delay to show success message
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Background with Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-5xl font-bold text-teal-100">
              CLIRDEC:PRESENCE
            </h1>
            <p className="mb-8 text-xl text-cyan-100">
              Proximity and RFID-Enabled Smart Entry for Classroom Engagement
            </p>
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Real-time Attendance Monitoring
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">IoT Device Integration</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">Automated Notifications</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                <span className="text-cyan-100">
                  Ghost Attendance Prevention
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute right-0 top-0 hidden h-64 w-64 translate-x-32 -translate-y-32 rounded-full bg-white/5 xl:block xl:h-96 xl:w-96 xl:translate-x-48 xl:-translate-y-48"></div>
        <div className="absolute bottom-0 left-0 hidden h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-teal-300/10 xl:block xl:h-64 xl:w-64 xl:-translate-x-32 xl:translate-y-32"></div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile-only branding (left panel hidden on small screens) */}
          <div className="lg:hidden text-center pb-4 border-b border-gray-700/50">
            <h1 className="text-2xl font-bold text-teal-400 tracking-tight">
              CLIRDEC:PRESENCE
            </h1>
            <p className="text-sm text-cyan-200/90 mt-1">
              Proximity & RFID Smart Entry for Classroom Engagement
            </p>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-teal-400 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400">
              Sign in to access the attendance monitoring system
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
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
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {loginSuccess && (
              <div className="bg-green-900/50 border border-green-700 rounded-lg p-4">
                <div className="text-sm text-green-300">
                  Login successful! Redirecting to dashboard...
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">
                <button
                  type="button"
                  className="text-teal-400 hover:text-teal-300 underline"
                  onClick={() => setLocation("/forgot-password")}
                >
                  Forgot your password?
                </button>
              </p>
              <p className="text-sm text-gray-500">
                Central Luzon State University - IT Department
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

