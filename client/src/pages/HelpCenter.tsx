import React, { useState } from "react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "How do I start a new attendance session?",
    answer:
      'Navigate to the Live Attendance page and click the "Start Session" button. Make sure your RFID reader is connected and configured.',
  },
  {
    id: "2",
    question: "How do I add new students to the system?",
    answer:
      'Go to the Students page and click "Add Student". Fill in the required information including RFID card details. Only administrators can add students.',
  },
  {
    id: "3",
    question: "How do I view attendance reports?",
    answer:
      'Navigate to the Reports page, select your date range and filters, then click "Generate Report". You can export reports as CSV or PDF.',
  },
  {
    id: "4",
    question: "What should I do if the RFID reader is not working?",
    answer:
      "Check the IoT Devices page to ensure the device is online. Try restarting the device or contact technical support if issues persist.",
  },
  {
    id: "5",
    question: "How do I reset my password?",
    answer:
      'Click "Forgot Password" on the login page and enter your email address. You will receive a reset link via email.',
  },
];

const videoTutorials = [
  { id: "1", title: "Getting Started with CLIRDEC Presence", duration: "5:30" },
  { id: "2", title: "Setting Up RFID Readers", duration: "8:15" },
  { id: "3", title: "Managing Student Records", duration: "6:45" },
  { id: "4", title: "Generating Attendance Reports", duration: "4:20" },
  { id: "5", title: "System Health Monitoring", duration: "7:10" },
];

export const HelpCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "guide" | "faq" | "videos" | "support"
  >("guide");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Help Center</h2>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "guide", label: "User Guide" },
            { id: "faq", label: "FAQ" },
            { id: "videos", label: "Video Tutorials" },
            { id: "support", label: "Support" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* User Guide Tab */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Quick Start Guide
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  1. Login to the System
                </h4>
                <p className="text-gray-600 mt-1">
                  Use your email and password to log in. Contact your
                  administrator if you need account setup.
                </p>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  2. Navigate the Dashboard
                </h4>
                <p className="text-gray-600 mt-1">
                  The dashboard shows your attendance overview. Use the sidebar
                  to access different sections.
                </p>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  3. Start Attendance Sessions
                </h4>
                <p className="text-gray-600 mt-1">
                  Go to Live Attendance to start tracking student attendance
                  using RFID cards.
                </p>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  4. View Reports
                </h4>
                <p className="text-gray-600 mt-1">
                  Access the Reports section to generate attendance analytics
                  and export data.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              System Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  For Faculty
                </h4>
                <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
                  <li>View assigned class schedules</li>
                  <li>Start and manage attendance sessions</li>
                  <li>Access student rosters</li>
                  <li>Generate subject-specific reports</li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  For Administrators
                </h4>
                <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
                  <li>Manage users and permissions</li>
                  <li>Configure system settings</li>
                  <li>Monitor system health</li>
                  <li>Access all reports and data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Frequently Asked Questions
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {faqs.map((faq) => (
              <div key={faq.id} className="px-6 py-4">
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full text-left flex justify-between items-center"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {faq.question}
                  </span>
                  <span className="ml-6 flex-shrink-0">
                    {expandedFAQ === faq.id ? "−" : "+"}
                  </span>
                </button>
                {expandedFAQ === faq.id && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Tutorials Tab */}
      {activeTab === "videos" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Video Tutorials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videoTutorials.map((video) => (
              <div
                key={video.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <span className="text-indigo-600 text-xl">▶</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {video.title}
                    </h4>
                    <p className="text-xs text-gray-500">{video.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Tab */}
      {activeTab === "support" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Support
            </h3>
            <form className="space-y-4">
              <div>
                <label htmlFor="help-support-subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  id="help-support-subject"
                  name="subject"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Brief description of your issue"
                />
              </div>
              <div>
                <label htmlFor="help-support-priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select id="help-support-priority" name="priority" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="help-support-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="help-support-description"
                  name="description"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Detailed description of your issue or question"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Submit Support Ticket
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Version:</span>
                <span className="ml-2 text-gray-600">1.0.0</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Last Updated:</span>
                <span className="ml-2 text-gray-600">2024-01-15</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">
                  Support Email:
                </span>
                <span className="ml-2 text-gray-600">support@clirdec.com</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Phone:</span>
                <span className="ml-2 text-gray-600">+1 (555) 123-4567</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
