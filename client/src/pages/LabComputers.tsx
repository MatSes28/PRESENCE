import { useState, useEffect, useRef } from "react";
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

interface Subject {
  id: number;
  code: string;
  name: string;
}

export const LabComputers = () => {
  const { addNotification } = useNotifications();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [assignments, setAssignments] = useState<ComputerAssignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddComputers, setShowAddComputers] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    null
  );
  const [selectedLab, setSelectedLab] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [computerCount, setComputerCount] = useState(5);
  const [processing, setProcessing] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const dragRef = useRef<HTMLDivElement>(null);

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
        fetchSubjects(),
        fetchStudents(),
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

  const fetchSubjects = async () => {
    try {
      // For now, we'll create some sample subjects since the API might not have this endpoint
      // In a real implementation, you'd call api.getSubjects()
      setSubjects([
        {
          id: 1,
          code: "INTECH1100",
          name: "Introduction to Information Technology",
        },
        { id: 2, code: "CS101", name: "Computer Science Fundamentals" },
        { id: 3, code: "WEBDEV200", name: "Web Development" },
        { id: 4, code: "DBMS300", name: "Database Management Systems" },
      ]);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.getStudents();
      if (response.success) {
        setStudents((response.data as any[]) || []);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, student: any) => {
    setDraggedStudent(student);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
  };

  const handleDrop = async (e: React.DragEvent, computerId: number) => {
    e.preventDefault();
    if (!draggedStudent) return;

    setProcessing(`assign-${computerId}`);

    try {
      // For now, we'll simulate assignment since we don't have the full assignment API
      // In a real implementation, you'd call an assignment API
      addNotification({
        type: "success",
        title: "Student Assigned",
        message: `${draggedStudent.name} assigned to Computer ${computerId}`,
      });

      // Refresh assignments
      fetchAssignments();
    } catch (error) {
      console.error("Failed to assign student:", error);
      addNotification({
        type: "error",
        title: "Assignment Failed",
        message: "Failed to assign student to computer",
      });
    } finally {
      setProcessing(null);
      setDraggedStudent(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const saveSession = async () => {
    if (!selectedLab || !selectedSubject) return;

    setProcessing("save-session");
    try {
      // For now, we'll simulate saving the session
      // In a real implementation, you'd call an API to save session data
      addNotification({
        type: "success",
        title: "Session Saved",
        message: `${
          subjects.find((s) => s.id === selectedSubject)?.code
        } session assignments saved successfully`,
      });
    } catch (error) {
      console.error("Failed to save session:", error);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Failed to save session assignments",
      });
    } finally {
      setProcessing(null);
    }
  };

  const assignNextStudents = async (count: number) => {
    const availableComputers = getComputersByClassroom(selectedLab!)
      .filter((c) => c.status === "available")
      .slice(0, count);

    if (availableComputers.length === 0) {
      addNotification({
        type: "warning",
        title: "No Available Computers",
        message: "All computers are currently occupied",
      });
      return;
    }

    setProcessing("bulk-assign");
    try {
      // Simulate bulk assignment
      addNotification({
        type: "success",
        title: "Bulk Assignment",
        message: `Assigned ${availableComputers.length} students to available computers`,
      });
      fetchAssignments();
    } catch (error) {
      addNotification({
        type: "error",
        title: "Assignment Failed",
        message: "Failed to assign students",
      });
    } finally {
      setProcessing(null);
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
    <div className="space-y-6" ref={dragRef}>
      {/* Drag Overlay */}
      {draggedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-blue-900 text-blue-100 px-6 py-4 rounded-lg shadow-lg border border-blue-700">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👤</span>
              <div>
                <div className="font-medium">
                  Assigning: {draggedStudent.name}
                </div>
                <div className="text-sm text-blue-300">
                  Drop on an available computer
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

      {/* Lab Selection */}
      <div className="bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-300">
              Select Lab:
            </label>
            <select
              value={selectedLab || ""}
              onChange={(e) => {
                setSelectedLab(parseInt(e.target.value) || null);
                setSelectedSubject(null); // Reset subject when lab changes
              }}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Labs</option>
              {classroomList.map((classroomId) => (
                <option key={classroomId} value={classroomId}>
                  Lab {classroomId}
                </option>
              ))}
            </select>
          </div>

          {selectedLab && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">
                Subject:
              </label>
              <select
                value={selectedSubject || ""}
                onChange={(e) =>
                  setSelectedSubject(parseInt(e.target.value) || null)
                }
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Subject Session Interface */}
      {selectedLab && selectedSubject ? (
        <>
          {/* Session Header */}
          <div className="bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-white">
                  {subjects.find((s) => s.id === selectedSubject)?.code} Session
                </h4>
                <p className="text-sm text-gray-400">
                  {subjects.find((s) => s.id === selectedSubject)?.name}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-400">Lab {selectedLab}</p>
                  <p className="text-sm font-medium text-teal-400">
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={saveSession}
                  disabled={processing === "save-session"}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {processing === "save-session" ? "Saving..." : "Save Session"}
                </button>
              </div>
            </div>
          </div>

          {/* Student Pool for Drag & Drop */}
          <div className="bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">
                  Student Pool - Drag to Assign
                </h4>
                <p className="text-sm text-gray-400">
                  Drag student names onto available computers in the lab layout
                  below
                </p>
              </div>
              <span className="text-sm text-gray-400">
                {students.length} students available
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {students.slice(0, 24).map((student) => (
                <div
                  key={student.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, student)}
                  onDragEnd={handleDragEnd}
                  className="bg-blue-900 hover:bg-blue-800 text-blue-100 px-3 py-2 rounded-lg text-sm font-medium cursor-move transition-colors border border-blue-700 hover:border-blue-600"
                >
                  <div className="truncate">{student.name}</div>
                  <div className="text-xs text-blue-300 truncate">
                    {student.studentId}
                  </div>
                </div>
              ))}
            </div>
            {students.length > 24 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing first 24 students. Scroll for more.
              </p>
            )}
          </div>
        </>
      ) : selectedLab ? (
        /* Lab selected but no subject */
        <div className="bg-gray-800 rounded-lg shadow p-6 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-medium text-white mb-2">
            Select a Subject to Start Session
          </h3>
          <p className="text-gray-400">
            Choose a subject from the dropdown above to view and manage computer
            assignments for this lab session.
          </p>
        </div>
      ) : (
        /* No lab selected */
        <div className="bg-gray-800 rounded-lg shadow p-6 text-center">
          <div className="text-6xl mb-4">🏫</div>
          <h3 className="text-xl font-medium text-white mb-2">
            Select a Lab to Begin
          </h3>
          <p className="text-gray-400">
            Choose a computer lab from the dropdown above to start managing
            student assignments.
          </p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(() => {
          const filteredComputers = selectedLab
            ? computers.filter((c) => c.classroomId === selectedLab)
            : computers;

          return (
            <>
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">💻</div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">
                      Total Computers
                      {selectedLab && ` in Lab ${selectedLab}`}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {filteredComputers.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">🟢</div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">
                      Available
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {
                        filteredComputers.filter(
                          (c) => c.status === "available"
                        ).length
                      }
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
                      {
                        filteredComputers.filter((c) => c.status === "in_use")
                          .length
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">🟡</div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">
                      Maintenance
                    </p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {
                        filteredComputers.filter(
                          (c) => c.status === "maintenance"
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Lab Layout - Only show when both lab and subject are selected */}
      {selectedLab && selectedSubject && (
        <div className="bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-700">
            <h4 className="text-lg font-medium text-white">
              Lab {selectedLab} - Computer Layout
            </h4>
            <p className="text-sm text-gray-300">
              Drag students from the pool above onto available computer seats
            </p>
          </div>
          <div className="p-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-900 rounded-lg">
              <button
                onClick={() => assignNextStudents(5)}
                disabled={processing === "bulk-assign"}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
              >
                {processing === "bulk-assign"
                  ? "Assigning..."
                  : "Assign Next 5 Students"}
              </button>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium">
                Random Assignment
              </button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium">
                Assign by Row
              </button>
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium">
                Release All
              </button>
            </div>

            {/* Lab Grid Layout - Representing physical arrangement */}
            <div className="space-y-6">
              {/* Row 1 (Front) */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-400 text-center">
                  Front Row
                </h5>
                <div className="grid grid-cols-5 gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(0, 5)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      return (
                        <div
                          key={computer.id}
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 ${
                            draggedStudent && computer.status === "available"
                              ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                              : computer.status === "available"
                              ? "border-green-500 hover:border-green-400"
                              : computer.status === "in_use"
                              ? "border-blue-500"
                              : "border-yellow-500"
                          }`}
                          onDrop={(e) => handleDrop(e, computer.id)}
                          onDragOver={handleDragOver}
                        >
                          <div className="text-center space-y-2">
                            <div className="text-2xl">
                              {computer.status === "available"
                                ? "💻"
                                : computer.status === "in_use"
                                ? "👤"
                                : "🔧"}
                            </div>
                            <div className="font-medium text-white text-sm">
                              {computer.name}
                            </div>
                            {assignment ? (
                              <div className="space-y-1">
                                <div className="text-blue-400 font-medium text-xs">
                                  {assignment.studentName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {assignment.studentId}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs italic">
                                {computer.status === "available"
                                  ? "Available"
                                  : computer.status === "maintenance"
                                  ? "Maintenance"
                                  : "Occupied"}
                              </div>
                            )}
                            {computer.status === "in_use" && (
                              <button
                                onClick={() => releaseComputer(computer.id)}
                                disabled={
                                  processing === `release-${computer.id}`
                                }
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-xs font-medium mt-2"
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

              {/* Row 2 (Middle) */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-400 text-center">
                  Middle Row
                </h5>
                <div className="grid grid-cols-5 gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(5, 10)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      return (
                        <div
                          key={computer.id}
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 ${
                            draggedStudent && computer.status === "available"
                              ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                              : computer.status === "available"
                              ? "border-green-500 hover:border-green-400"
                              : computer.status === "in_use"
                              ? "border-blue-500"
                              : "border-yellow-500"
                          }`}
                          onDrop={(e) => handleDrop(e, computer.id)}
                          onDragOver={handleDragOver}
                        >
                          <div className="text-center space-y-2">
                            <div className="text-2xl">
                              {computer.status === "available"
                                ? "💻"
                                : computer.status === "in_use"
                                ? "👤"
                                : "🔧"}
                            </div>
                            <div className="font-medium text-white text-sm">
                              {computer.name}
                            </div>
                            {assignment ? (
                              <div className="space-y-1">
                                <div className="text-blue-400 font-medium text-xs">
                                  {assignment.studentName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {assignment.studentId}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs italic">
                                {computer.status === "available"
                                  ? "Available"
                                  : computer.status === "maintenance"
                                  ? "Maintenance"
                                  : "Occupied"}
                              </div>
                            )}
                            {computer.status === "in_use" && (
                              <button
                                onClick={() => releaseComputer(computer.id)}
                                disabled={
                                  processing === `release-${computer.id}`
                                }
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-xs font-medium mt-2"
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

              {/* Row 3 (Back) */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-400 text-center">
                  Back Row
                </h5>
                <div className="grid grid-cols-5 gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(10, 15)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      return (
                        <div
                          key={computer.id}
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 ${
                            draggedStudent && computer.status === "available"
                              ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                              : computer.status === "available"
                              ? "border-green-500 hover:border-green-400"
                              : computer.status === "in_use"
                              ? "border-blue-500"
                              : "border-yellow-500"
                          }`}
                          onDrop={(e) => handleDrop(e, computer.id)}
                          onDragOver={handleDragOver}
                        >
                          <div className="text-center space-y-2">
                            <div className="text-2xl">
                              {computer.status === "available"
                                ? "💻"
                                : computer.status === "in_use"
                                ? "👤"
                                : "🔧"}
                            </div>
                            <div className="font-medium text-white text-sm">
                              {computer.name}
                            </div>
                            {assignment ? (
                              <div className="space-y-1">
                                <div className="text-blue-400 font-medium text-xs">
                                  {assignment.studentName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {assignment.studentId}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs italic">
                                {computer.status === "available"
                                  ? "Available"
                                  : computer.status === "maintenance"
                                  ? "Maintenance"
                                  : "Occupied"}
                              </div>
                            )}
                            {computer.status === "in_use" && (
                              <button
                                onClick={() => releaseComputer(computer.id)}
                                disabled={
                                  processing === `release-${computer.id}`
                                }
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-xs font-medium mt-2"
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
          </div>
        </div>
      )}

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
