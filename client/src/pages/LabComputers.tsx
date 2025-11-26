import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

interface Computer {
  id: number;
  classroomId: number;
  name: string;
  status: "available" | "in_use" | "maintenance";
}

interface ComputerAssignment {
  id: number;
  computerId: number;
  studentId: number;
  studentName: string;
  classSessionId: number;
  assignedAt: string;
  releasedAt?: string;
  status: "assigned" | "active" | "completed";
}

interface Classroom {
  id: number;
  name: string;
}

export const LabComputers = () => {
  const { addNotification } = useNotifications();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [assignments, setAssignments] = useState<ComputerAssignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddComputers, setShowAddComputers] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    null
  );
  const [computerCount, setComputerCount] = useState(5);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchComputers(),
        fetchAssignments(),
        fetchClassrooms(),
      ]);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      }
    } catch (error) {
      console.error("Failed to fetch computers:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
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
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to connect to the server. Please check your connection.",
      });
    }
  };

  const fetchClassrooms = async () => {
    try {
      const response = await api.getClassrooms();
      if (response.success) {
        setClassrooms((response.data as Classroom[]) || []);
      }
    } catch (error) {
      console.error("Failed to fetch classrooms:", error);
    }
  };

  const addComputers = async () => {
    if (!selectedClassroom) {
      addNotification({
        type: "error",
        title: "No Classroom Selected",
        message: "Please select a classroom first",
      });
      return;
    }

    setProcessing("add-computers");
    try {
      const response = await api.createComputers(
        selectedClassroom,
        computerCount
      );
      if (response.success) {
        addNotification({
          type: "success",
          title: "Computers Added",
          message:
            response.message || `Successfully added ${computerCount} computers`,
        });
        setShowAddComputers(false);
        setSelectedClassroom(null);
        setComputerCount(5);
        fetchComputers();
      } else {
        addNotification({
          type: "error",
          title: "Failed to Add Computers",
          message: response.message || "Unable to add computers",
        });
      }
    } catch (error) {
      console.error("Failed to add computers:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to add computers. Please check your connection.",
      });
    } finally {
      setProcessing(null);
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-900 text-green-300";
      case "in_use":
      case "active":
        return "bg-blue-900 text-blue-300";
      case "maintenance":
        return "bg-yellow-900 text-yellow-300";
      default:
        return "bg-gray-900 text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return "🟢";
      case "in_use":
      case "active":
        return "🔵";
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

  const classroomList = [...new Set(computers.map((comp) => comp.classroomId))];

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
            Computer Lab Management
          </h3>
          <p className="text-sm text-gray-300">
            Simple computer assignment for faculty
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
          <button
            onClick={() => setShowAddComputers(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add Computers
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
            <div className="text-2xl mr-3">🟢</div>
            <div>
              <p className="text-sm font-medium text-gray-300">Available</p>
              <p className="text-2xl font-bold text-green-400">
                {computers.filter((c) => c.status === "available").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🔵</div>
            <div>
              <p className="text-sm font-medium text-gray-300">In Use</p>
              <p className="text-2xl font-bold text-blue-400">
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

      {/* Computer Labs */}
      {classroomList.map((classroomId) => {
        const classroomComputers = getComputersByClassroom(classroomId);
        if (classroomComputers.length === 0) return null;

        return (
          <div key={classroomId} className="bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h4 className="text-lg font-medium text-white">
                Lab Room {classroomId}
              </h4>
              <p className="text-sm text-gray-300">
                {
                  classroomComputers.filter((c) => c.status === "available")
                    .length
                }{" "}
                available •
                {classroomComputers.filter((c) => c.status === "in_use").length}{" "}
                in use
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
                          {computer.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-400">
                        {assignment && (
                          <div className="space-y-1">
                            <div className="text-blue-400 font-medium">
                              Assigned to: {assignment.studentName}
                            </div>
                            <div className="text-xs text-gray-500">
                              Since:{" "}
                              {new Date(
                                assignment.assignedAt
                              ).toLocaleTimeString()}
                            </div>
                          </div>
                        )}
                        {!assignment && computer.status === "available" && (
                          <div className="text-gray-500 italic">
                            Ready for assignment
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Computers Modal */}
      {showAddComputers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800 border-gray-700">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  Add Computers to Lab
                </h3>
                <button
                  onClick={() => setShowAddComputers(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Lab Room
                  </label>
                  <select
                    value={selectedClassroom || ""}
                    onChange={(e) =>
                      setSelectedClassroom(parseInt(e.target.value) || null)
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Choose a room...</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name} (Room {classroom.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Number of Computers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={computerCount}
                    onChange={(e) =>
                      setComputerCount(parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAddComputers(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addComputers}
                    disabled={processing === "add-computers"}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {processing === "add-computers"
                      ? "Adding..."
                      : "Add Computers"}
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
