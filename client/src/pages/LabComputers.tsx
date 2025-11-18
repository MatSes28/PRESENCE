import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

interface Computer {
  id: number;
  classroomId: number;
  name: string;
  ipAddress?: string;
  macAddress?: string;
  status: "available" | "in_use" | "maintenance";
  currentUser?: string;
  lastUsed?: string;
}

interface ComputerAssignment {
  id: number;
  computerId: number;
  studentId: number;
  studentName: string;
  assignedAt: string;
  releasedAt?: string;
  loginTime?: string;
  logoutTime?: string;
  sessionDuration?: number;
  status: "assigned" | "active" | "completed";
}

export const LabComputers = () => {
  const { addNotification } = useNotifications();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [assignments, setAssignments] = useState<ComputerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComputer, setSelectedComputer] = useState<Computer | null>(
    null
  );
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchComputers();
    fetchAssignments();
  }, []);

  // Add a separate useEffect to handle loading state
  useEffect(() => {
    // Set loading to false after a reasonable timeout to prevent infinite loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timer);
  }, []);

  const fetchComputers = async () => {
    try {
      const response = await api.getComputers();
      if (response.success) {
        setComputers((response.data as Computer[]) || []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Computers",
          message: response.message || "Unable to fetch computer data",
        });
        setComputers([]);
      }
    } catch (error) {
      console.error("Failed to fetch computers:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setComputers([]);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await api.getComputerAssignments();
      if (response.success) {
        setAssignments((response.data as ComputerAssignment[]) || []);
      } else {
        addNotification({
          type: "error",
          title: "Failed to Load Assignments",
          message: response.message || "Unable to fetch assignment data",
        });
        setAssignments([]);
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-gray-900 text-gray-300"; // Changed to gray for available
      case "in_use":
      case "active":
        return "bg-green-900 text-green-300"; // Changed to green for occupied
      case "maintenance":
        return "bg-yellow-900 text-yellow-300";
      default:
        return "bg-gray-900 text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return "⚫"; // Gray circle for available
      case "in_use":
      case "active":
        return "🟢"; // Green circle for occupied
      case "maintenance":
        return "🟡";
      default:
        return "⚫";
    }
  };

  const getComputersByClassroom = (classroomId: number) => {
    return computers.filter((comp) => comp.classroomId === classroomId);
  };

  const getAssignmentForComputer = (computerId: number) => {
    return assignments.find(
      (assignment) =>
        assignment.computerId === computerId && !assignment.releasedAt
    );
  };

  const releaseComputer = async (computerId: number) => {
    setProcessing(`release-${computerId}`);
    try {
      const assignment = assignments.find(
        (a) => a.computerId === computerId && !a.releasedAt
      );
      if (assignment) {
        const response = await api.releaseComputer(assignment.id);
        if (response.success) {
          addNotification({
            type: "success",
            title: "Computer Released",
            message:
              "Computer has been successfully released from the current user.",
          });
          fetchComputers();
          fetchAssignments();
        } else {
          addNotification({
            type: "error",
            title: "Release Failed",
            message: response.message || "Failed to release computer",
          });
        }
      }
    } catch (error) {
      console.error("Failed to release computer:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to release computer. Please check your connection and try again.",
      });
    } finally {
      setProcessing(null);
    }
  };

  const setMaintenance = async (computerId: number, maintenance: boolean) => {
    setProcessing(`maintenance-${computerId}`);
    try {
      const response = await api.updateComputer(computerId, {
        status: maintenance ? "maintenance" : "available",
      });
      if (response.success) {
        addNotification({
          type: "success",
          title: "Status Updated",
          message: `Computer ${
            maintenance ? "set to maintenance" : "activated"
          } successfully!`,
        });
        fetchComputers();
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update computer status",
        });
      }
    } catch (error) {
      console.error("Failed to update computer status:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to update computer status. Please check your connection and try again.",
      });
    } finally {
      setProcessing(null);
    }
  };

  const classrooms = [...new Set(computers.map((comp) => comp.classroomId))];

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
          <h3 className="text-lg font-medium text-white">
            Lab Computer Management
          </h3>
          <p className="text-sm text-gray-300">
            Monitor and manage computer lab resources
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              fetchComputers();
              fetchAssignments();
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">💻</div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Total Computers
              </p>
              <p className="text-2xl font-bold text-white">
                {computers.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">⚫</div>
            <div>
              <p className="text-sm font-medium text-gray-300">Available</p>
              <p className="text-2xl font-bold text-gray-400">
                {computers.filter((c) => c.status === "available").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🟢</div>
            <div>
              <p className="text-sm font-medium text-gray-300">Occupied</p>
              <p className="text-2xl font-bold text-green-400">
                {computers.filter((c) => c.status === "in_use").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🟡</div>
            <div>
              <p className="text-sm font-medium text-gray-300">Maintenance</p>
              <p className="text-2xl font-bold text-yellow-400">
                {computers.filter((c) => c.status === "maintenance").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Laboratory Computer Usage Monitoring */}
      {classrooms.map((classroomId) => {
        const classroomComputers = getComputersByClassroom(classroomId);
        // Show all classrooms with computers (remove the lab room filter)
        if (classroomComputers.length === 0) return null;

        return (
          <div key={classroomId} className="bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h4 className="text-lg font-medium text-white">
                Room {classroomId}
              </h4>
              <p className="text-sm text-gray-300">
                Real-time computer usage monitoring •
                {
                  classroomComputers.filter((c) => c.status === "available")
                    .length
                }{" "}
                available •
                {classroomComputers.filter((c) => c.status === "in_use").length}{" "}
                occupied
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classroomComputers.map((computer) => {
                  const assignment = getAssignmentForComputer(computer.id);
                  return (
                    <div
                      key={computer.id}
                      className="border border-gray-700 rounded-lg p-4 bg-gray-900"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {getStatusIcon(computer.status)}
                          </span>
                          <span className="font-medium text-white">
                            {computer.name}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            computer.status
                          )}`}
                        >
                          {computer.status === "in_use"
                            ? "occupied"
                            : computer.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-400">
                        <div>IP: {computer.ipAddress}</div>
                        {computer.macAddress && (
                          <div>MAC: {computer.macAddress}</div>
                        )}
                        {assignment && (
                          <div className="space-y-1">
                            <div className="text-green-400 font-medium">
                              Currently using: {assignment.studentName}
                            </div>
                            {assignment.loginTime && (
                              <div className="text-xs text-gray-500">
                                Started at:{" "}
                                {new Date(
                                  assignment.loginTime
                                ).toLocaleTimeString()}
                              </div>
                            )}
                            {assignment.sessionDuration && (
                              <div className="text-xs text-gray-500">
                                Duration: {assignment.sessionDuration} min
                              </div>
                            )}
                          </div>
                        )}
                        {!assignment && computer.status === "available" && (
                          <div className="text-gray-500 italic">
                            Available for use
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2 mt-4">
                        {computer.status === "in_use" && (
                          <button
                            onClick={() => releaseComputer(computer.id)}
                            disabled={processing === `release-${computer.id}`}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-xs font-medium"
                          >
                            {processing === `release-${computer.id}`
                              ? "Releasing..."
                              : "Release"}
                          </button>
                        )}
                        {computer.status !== "maintenance" && (
                          <button
                            onClick={() => setMaintenance(computer.id, true)}
                            disabled={
                              processing === `maintenance-${computer.id}`
                            }
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-xs font-medium"
                          >
                            {processing === `maintenance-${computer.id}`
                              ? "Setting..."
                              : "Maintenance"}
                          </button>
                        )}
                        {computer.status === "maintenance" && (
                          <button
                            onClick={() => setMaintenance(computer.id, false)}
                            disabled={
                              processing === `maintenance-${computer.id}`
                            }
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-xs font-medium"
                          >
                            {processing === `maintenance-${computer.id}`
                              ? "Activating..."
                              : "Activate"}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedComputer(computer)}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs font-medium"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Real-Time Computer Usage Monitoring */}
      <div className="bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">
            Real-Time Computer Usage
          </h4>
          <p className="text-sm text-gray-300">
            Live monitoring of laboratory computer sessions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Computer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Assigned At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {assignments
                .filter((a) => !a.releasedAt)
                .map((assignment) => {
                  const computer = computers.find(
                    (c) => c.id === assignment.computerId
                  );
                  const duration = Math.floor(
                    (Date.now() - new Date(assignment.assignedAt).getTime()) /
                      60000
                  ); // minutes

                  return (
                    <tr key={assignment.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {computer?.name} (Room {computer?.classroomId})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {assignment.studentName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {new Date(assignment.assignedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {assignment.sessionDuration
                          ? `${assignment.sessionDuration} min`
                          : `${duration} min`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => releaseComputer(assignment.computerId)}
                          disabled={
                            processing === `release-${assignment.computerId}`
                          }
                          className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed"
                        >
                          {processing === `release-${assignment.computerId}`
                            ? "Releasing..."
                            : "Release"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {assignments.filter((a) => !a.releasedAt).length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No active computer assignments</p>
          </div>
        )}
      </div>

      {/* Computer Details Modal */}
      {selectedComputer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800 border-gray-700">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  Computer Details: {selectedComputer.name}
                </h3>
                <button
                  onClick={() => setSelectedComputer(null)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Status
                    </label>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        selectedComputer.status
                      )}`}
                    >
                      {selectedComputer.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Room
                    </label>
                    <span className="text-sm text-white">
                      {selectedComputer.classroomId}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Network Info
                  </label>
                  <div className="bg-gray-900 p-3 rounded text-sm text-white">
                    <div>IP: {selectedComputer.ipAddress}</div>
                    {selectedComputer.macAddress && (
                      <div>MAC: {selectedComputer.macAddress}</div>
                    )}
                  </div>
                </div>

                {selectedComputer.currentUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Current User
                    </label>
                    <div className="bg-blue-900 p-3 rounded text-sm text-blue-300">
                      {selectedComputer.currentUser}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedComputer(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
