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
    null,
  );
  const [selectedLab, setSelectedLab] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [computerCount, setComputerCount] = useState(5);
  const [processing, setProcessing] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  // Assignment-only system - no computer status monitoring
  const [showSmartAssignModal, setShowSmartAssignModal] = useState(false);
  const [smartAssignSessionId, setSmartAssignSessionId] = useState<
    number | null
  >(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const dragRef = useRef<HTMLDivElement>(null);

  // Bulk operations state
  const [selectedComputers, setSelectedComputers] = useState<Set<number>>(
    new Set(),
  );
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [simpleAssignMode, setSimpleAssignMode] = useState(false);
  const [selectedStudentForSimpleAssign, setSelectedStudentForSimpleAssign] =
    useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Load maintenance records when modal opens
  useEffect(() => {
    if (showMaintenanceModal) {
      loadMaintenanceRecords();
    }
  }, [showMaintenanceModal]);

  // Assignment-only system - no computer status monitoring

  // Assignment-only system - no monitoring features

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
      const response = await api.getSubjects();
      const raw = (response as any)?.data;
      if (response.success && Array.isArray(raw)) {
        setSubjects(raw as Subject[]);
      } else {
        setSubjects([]);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      setSubjects([]);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.getStudents();
      const raw = (response as any)?.data;
      if (response.success && Array.isArray(raw)) {
        setStudents(raw);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setStudents([]);
    }
  };

  const loadMaintenanceRecords = async () => {
    try {
      const response = await api.getMaintenanceRecords();
      if (response.success) {
        setMaintenanceRecords((response.data as any[]) || []);
      }
    } catch (error) {
      console.error("Failed to fetch maintenance records:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, student: any) => {
    setDraggedStudent(student);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTouchStart = (e: React.TouchEvent, student: any) => {
    setDraggedStudent(student);
    // Prevent scrolling when touching draggable elements
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedStudent) return;

    // Prevent scrolling during drag
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Add visual feedback for potential drop targets
    if (element?.closest("[data-drop-target]")) {
      element.closest("[data-drop-target]")?.classList.add("touch-hover");
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!draggedStudent) return;

    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find the drop target
    const dropTarget = element?.closest("[data-computer-id]");
    if (dropTarget) {
      const computerId = parseInt(
        dropTarget.getAttribute("data-computer-id") || "0",
      );
      handleDrop(e as any, computerId);
    }

    // Clean up touch hover states
    document.querySelectorAll(".touch-hover").forEach((el) => {
      el.classList.remove("touch-hover");
    });

    setDraggedStudent(null);
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
  };

  const handleDrop = async (e: React.DragEvent, computerId: number) => {
    e.preventDefault();
    if (!draggedStudent || !selectedSubject) return;

    setProcessing(`assign-${computerId}`);

    try {
      const sessionsResponse = await api.getClassSessions();
      const sessionsList = (sessionsResponse as any)?.sessions;
      const activeItem =
        Array.isArray(sessionsList) && selectedSubject != null
          ? sessionsList.find(
              (item: any) =>
                item.session?.status === "active" &&
                item.schedule?.subjectId === selectedSubject,
            )
          : null;
      const sessionId = activeItem?.session?.id;

      if (sessionId == null) {
        setProcessing(null);
        addNotification({
          type: "error",
          title: "No Active Session",
          message:
            "No active class session for this subject. Start or select an active session first.",
        });
        return;
      }

      const response = await api.assignComputer({
        computerId,
        studentId: draggedStudent.id,
        classSessionId: sessionId,
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Assigned",
          message: `${draggedStudent.name} assigned to Computer ${computerId}`,
        });

        // Refresh assignments and computers
        fetchAssignments();
        fetchComputers();
      } else {
        addNotification({
          type: "error",
          title: "Assignment Failed",
          message: response.message || "Failed to assign student to computer",
        });
      }
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

  const handleSmartAssignment = async (assignmentType: string) => {
    if (!smartAssignSessionId) return;

    setProcessing(`smart-assign-${assignmentType}`);
    try {
      let response;
      switch (assignmentType) {
        case "performance":
          response = await api.assignByPerformance(smartAssignSessionId);
          break;
        case "learning-style":
          response = await api.assignByLearningStyle(smartAssignSessionId);
          break;
        case "conflict-free":
          response = await api.assignConflictFree(smartAssignSessionId);
          break;
        case "random":
          response = await api.assignRandom(smartAssignSessionId);
          break;
        default:
          throw new Error("Unknown assignment type");
      }

      if (response.success) {
        addNotification({
          type: "success",
          title: "Smart Assignment Complete",
          message: response.message || "Students assigned successfully",
        });
        setShowSmartAssignModal(false);
        setSmartAssignSessionId(null);
        fetchAssignments();
      } else {
        addNotification({
          type: "error",
          title: "Assignment Failed",
          message: response.message || "Failed to perform smart assignment",
        });
      }
    } catch (error) {
      console.error("Smart assignment error:", error);
      addNotification({
        type: "error",
        title: "Assignment Failed",
        message: "Failed to perform smart assignment",
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
        computerCount,
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
        (a) => a.computerId === computerId && !a.releasedAt,
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

  // Bulk operations
  const handleSelectComputer = (computerId: number, selected: boolean) => {
    setSelectedComputers((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(computerId);
      } else {
        newSet.delete(computerId);
      }
      return newSet;
    });
  };

  const handleSelectAllComputers = (selected: boolean) => {
    if (selected) {
      const allComputerIds = getComputersByClassroom(selectedLab!).map(
        (c) => c.id,
      );
      setSelectedComputers(new Set(allComputerIds));
    } else {
      setSelectedComputers(new Set());
    }
  };

  const handleBulkRelease = async () => {
    if (selectedComputers.size === 0) return;

    setProcessing("bulk-release");

    try {
      const releasePromises = Array.from(selectedComputers).map(
        async (computerId) => {
          const assignment = assignments.find(
            (a) => a.computerId === computerId && !a.releasedAt,
          );
          if (assignment) {
            return api.releaseComputer(assignment.id);
          }
          return null;
        },
      );

      const results = await Promise.allSettled(releasePromises.filter(Boolean));
      const successCount = results.filter(
        (result) => result.status === "fulfilled" && result.value?.success,
      ).length;

      addNotification({
        type: "success",
        title: "Bulk Release Completed",
        message: `Successfully released ${successCount} out of ${selectedComputers.size} computers`,
      });

      setSelectedComputers(new Set());
      fetchComputers();
      fetchAssignments();
    } catch (error) {
      console.error("Bulk release error:", error);
      addNotification({
        type: "error",
        title: "Bulk Operation Failed",
        message: "Failed to complete bulk release operation",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedComputers.size === 0 || !selectedStudentForSimpleAssign) return;

    setProcessing("bulk-assign");

    try {
      const sessionsResponse = await api.getClassSessions();
      const sessionsList = (sessionsResponse as any)?.sessions;
      const activeItem =
        Array.isArray(sessionsList) && selectedSubject != null
          ? sessionsList.find(
              (item: any) =>
                item.session?.status === "active" &&
                item.schedule?.subjectId === selectedSubject,
            )
          : null;
      const sessionId = activeItem?.session?.id;

      if (sessionId == null) {
        setProcessing(null);
        addNotification({
          type: "error",
          title: "No Active Session",
          message:
            "No active class session for this subject. Start or select an active session first.",
        });
        return;
      }

      const assignPromises = Array.from(selectedComputers).map((computerId) =>
        api.assignComputer({
          computerId,
          studentId: selectedStudentForSimpleAssign.id,
          classSessionId: sessionId,
        }),
      );

      const results = await Promise.allSettled(assignPromises);
      const successCount = results.filter(
        (result) => result.status === "fulfilled" && result.value?.success,
      ).length;

      addNotification({
        type: "success",
        title: "Bulk Assignment Completed",
        message: `Successfully assigned ${selectedStudentForSimpleAssign.name} to ${successCount} computers`,
      });

      setSelectedComputers(new Set());
      setSelectedStudentForSimpleAssign(null);
      setSimpleAssignMode(false);
      fetchComputers();
      fetchAssignments();
    } catch (error) {
      console.error("Bulk assign error:", error);
      addNotification({
        type: "error",
        title: "Bulk Operation Failed",
        message: "Failed to complete bulk assignment operation",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleSimpleAssign = async (computerId: number) => {
    if (!selectedStudentForSimpleAssign) return;

    setProcessing(`assign-${computerId}`);

    try {
      const sessionsResponse = await api.getClassSessions();
      const sessionsList = (sessionsResponse as any)?.sessions;
      const activeItem =
        Array.isArray(sessionsList) && selectedSubject != null
          ? sessionsList.find(
              (item: any) =>
                item.session?.status === "active" &&
                item.schedule?.subjectId === selectedSubject,
            )
          : null;
      const sessionId = activeItem?.session?.id;

      if (sessionId == null) {
        setProcessing(null);
        addNotification({
          type: "error",
          title: "No Active Session",
          message:
            "No active class session for this subject. Start or select an active session first.",
        });
        return;
      }

      const response = await api.assignComputer({
        computerId,
        studentId: selectedStudentForSimpleAssign.id,
        classSessionId: sessionId,
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Student Assigned",
          message: `${selectedStudentForSimpleAssign.name} assigned to Computer ${computerId}`,
        });
        fetchComputers();
        fetchAssignments();
      } else {
        addNotification({
          type: "error",
          title: "Assignment Failed",
          message: response.message || "Failed to assign student to computer",
        });
      }
    } catch (error) {
      console.error("Failed to assign student:", error);
      addNotification({
        type: "error",
        title: "Assignment Failed",
        message: "Failed to assign student to computer",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getComputersByClassroom = (classroomId: number) => {
    return computers.filter((comp) => comp.classroomId === classroomId);
  };

  const getAssignmentForComputer = (computerId: number) => {
    return assignments.find(
      (assignment) =>
        assignment.computerId === computerId && !assignment.releasedAt,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-medium text-white">
            Computer Lab Management
          </h3>
          <p className="text-sm text-gray-300">
            Simple computer assignment for faculty
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <button
            onClick={() => {
              fetchComputers();
              fetchAssignments();
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Refresh
          </button>
          <button
            onClick={() => setSimpleAssignMode(!simpleAssignMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto ${
              simpleAssignMode
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {simpleAssignMode ? "Exit Simple Assign" : "Simple Assign"}
          </button>
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            disabled={selectedComputers.size === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Bulk Actions ({selectedComputers.size})
          </button>
          <button
            onClick={() => setShowSmartAssignModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Smart Assign
          </button>
          <button
            onClick={() => setShowAddComputers(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Add Computers
          </button>
          <button
            onClick={() => setShowMaintenanceModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Lab Selection */}
      <div className="bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            <label htmlFor="lab-computers-lab-select" className="text-sm font-medium text-gray-300 whitespace-nowrap">
              Select Lab:
            </label>
            <select
              id="lab-computers-lab-select"
              name="selectedLab"
              value={selectedLab || ""}
              onChange={(e) => {
                setSelectedLab(parseInt(e.target.value) || null);
                setSelectedSubject(null); // Reset subject when lab changes
              }}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
              <label htmlFor="lab-computers-subject-select" className="text-sm font-medium text-gray-300 whitespace-nowrap">
                Subject:
              </label>
              <select
                id="lab-computers-subject-select"
                name="selectedSubject"
                value={selectedSubject || ""}
                onChange={(e) =>
                  setSelectedSubject(parseInt(e.target.value) || null)
                }
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
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
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
              <div>
                <h4 className="text-lg font-medium text-white">
                  {subjects.find((s) => s.id === selectedSubject)?.code} Session
                </h4>
                <p className="text-sm text-gray-400">
                  {subjects.find((s) => s.id === selectedSubject)?.name}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full lg:w-auto">
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-400">Lab {selectedLab}</p>
                  <p className="text-sm font-medium text-teal-400">
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={saveSession}
                  disabled={processing === "save-session"}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium w-full sm:w-auto"
                >
                  {processing === "save-session" ? "Saving..." : "Save Session"}
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions Panel */}
          {showBulkActions && selectedComputers.size > 0 && (
            <div className="bg-indigo-900 border border-indigo-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="text-lg font-medium text-white">
                  Bulk Actions ({selectedComputers.size} computers selected)
                </h5>
                <button
                  onClick={() => setShowBulkActions(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleBulkRelease}
                  disabled={processing === "bulk-release"}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {processing === "bulk-release"
                    ? "Releasing..."
                    : "Release All Selected"}
                </button>
                <button
                  onClick={() => setSelectedComputers(new Set())}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Student Pool */}
          <div className="bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">
                  {simpleAssignMode ? "Simple Assignment Mode" : "Student Pool"}
                </h4>
                <p className="text-sm text-gray-400">
                  {simpleAssignMode
                    ? "Select a student below, then click on computers to assign them"
                    : "Drag student names onto available computers or use simple assign mode"}
                </p>
              </div>
              <span className="text-sm text-gray-400">
                {students.length} students available
              </span>
            </div>

            {simpleAssignMode && (
              <div className="mb-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-blue-300">Selected Student:</span>
                  {selectedStudentForSimpleAssign ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">
                        {selectedStudentForSimpleAssign.name} (
                        {selectedStudentForSimpleAssign.studentId})
                      </span>
                      <button
                        onClick={() => setSelectedStudentForSimpleAssign(null)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400">None selected</span>
                  )}
                </div>
                {selectedComputers.size > 0 &&
                  selectedStudentForSimpleAssign && (
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        onClick={handleBulkAssign}
                        disabled={processing === "bulk-assign"}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm font-medium"
                      >
                        {processing === "bulk-assign"
                          ? "Assigning..."
                          : `Assign to ${selectedComputers.size} computers`}
                      </button>
                    </div>
                  )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {students.slice(0, 24).map((student) => (
                <div
                  key={student.id}
                  draggable={!simpleAssignMode}
                  onDragStart={(e) =>
                    !simpleAssignMode && handleDragStart(e, student)
                  }
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) =>
                    !simpleAssignMode && handleTouchStart(e, student)
                  }
                  onTouchMove={(e) => !simpleAssignMode && handleTouchMove(e)}
                  onTouchEnd={(e) => !simpleAssignMode && handleTouchEnd(e)}
                  onClick={() =>
                    simpleAssignMode &&
                    setSelectedStudentForSimpleAssign(student)
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors border select-none ${
                    simpleAssignMode
                      ? selectedStudentForSimpleAssign?.id === student.id
                        ? "bg-green-900 text-green-100 border-green-600"
                        : "bg-blue-900 hover:bg-blue-800 text-blue-100 border-blue-700 hover:border-blue-600"
                      : "bg-blue-900 hover:bg-blue-800 active:bg-blue-700 text-blue-100 border-blue-700 hover:border-blue-600 cursor-move touch-manipulation"
                  }`}
                >
                  <div className="truncate">{student.name}</div>
                  <div className="text-xs opacity-80 truncate">
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
                          (c) => c.status === "available",
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
                          (c) => c.status === "maintenance",
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
        <div className="bg-gray-800 rounded-lg shadow relative overflow-hidden">
          {/* Physical Lab Environment */}
          <div className="absolute inset-0 opacity-10">
            {/* Walls */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gray-600"></div>
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-600"></div>
            <div className="absolute top-0 bottom-0 left-0 w-2 bg-gray-600"></div>
            <div className="absolute top-0 bottom-0 right-0 w-2 bg-gray-600"></div>

            {/* Pathways */}
            <div className="absolute top-20 left-0 right-0 h-1 bg-gray-500 opacity-50"></div>
            <div className="absolute top-40 left-0 right-0 h-1 bg-gray-500 opacity-50"></div>
            <div className="absolute top-60 left-0 right-0 h-1 bg-gray-500 opacity-50"></div>
          </div>

          <div className="px-6 py-4 border-b border-gray-700 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-white">
                  Lab {selectedLab} - Physical Layout
                </h4>
                <p className="text-sm text-gray-300">
                  {simpleAssignMode
                    ? "Select computers and assign students easily"
                    : "Drag students from the pool above onto available computer seats"}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={
                      selectedComputers.size ===
                        getComputersByClassroom(selectedLab).length &&
                      getComputersByClassroom(selectedLab).length > 0
                    }
                    onChange={(e) => handleSelectAllComputers(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <span>Select All</span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-6 relative">
            {/* Instructor Station */}
            <div className="mb-8 flex justify-center">
              <div className="bg-gradient-to-r from-blue-800 to-blue-900 p-4 rounded-lg border-2 border-blue-600 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">👨‍🏫</div>
                  <div>
                    <div className="text-white font-medium">
                      Instructor Station
                    </div>
                    <div className="text-blue-200 text-sm">Front of Lab</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Door */}
            <div className="absolute top-8 right-8 z-20">
              <div className="bg-amber-800 p-3 rounded-lg border-2 border-amber-600 shadow-lg">
                <div className="text-2xl">🚪</div>
                <div className="text-amber-200 text-xs text-center">Exit</div>
              </div>
            </div>
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-900 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap gap-2 w-full">
                <button
                  onClick={() => assignNextStudents(5)}
                  disabled={processing === "bulk-assign"}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {processing === "bulk-assign"
                    ? "Assigning..."
                    : "Assign Next 5 Students"}
                </button>
                <button
                  onClick={() => {
                    const availableComputers = getComputersByClassroom(
                      selectedLab!,
                    )
                      .filter((c) => c.status === "available")
                      .slice(0, 5);
                    if (availableComputers.length > 0 && smartAssignSessionId) {
                      handleSmartAssignment("random");
                    } else if (!smartAssignSessionId) {
                      addNotification({
                        type: "warning",
                        title: "No Session Selected",
                        message:
                          "Please open Smart Assign modal and select a session first",
                      });
                    }
                  }}
                  disabled={processing === "smart-assign-random"}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {processing === "smart-assign-random"
                    ? "Assigning..."
                    : "Random Assignment"}
                </button>
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium">
                  Assign by Row
                </button>
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium">
                  Release All
                </button>
              </div>
            </div>

            {/* Lab Grid Layout - Representing physical arrangement */}
            <div className="space-y-8 relative">
              {/* Row 1 (Front) */}
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-px bg-gray-600 flex-1"></div>
                  <h5 className="text-sm font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded">
                    🎯 Front Row (Closest to Instructor)
                  </h5>
                  <div className="h-px bg-gray-600 flex-1"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(0, 5)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      const isSelected = selectedComputers.has(computer.id);

                      return (
                        <div
                          key={computer.id}
                          data-computer-id={computer.id}
                          data-drop-target="true"
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 relative ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-900/30 ring-2 ring-indigo-500"
                              : draggedStudent &&
                                  computer.status === "available"
                                ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                                : computer.status === "available"
                                  ? "border-green-500 hover:border-green-400"
                                  : computer.status === "in_use"
                                    ? "border-blue-500"
                                    : "border-yellow-500"
                          }`}
                          onDrop={(e) =>
                            !simpleAssignMode && handleDrop(e, computer.id)
                          }
                          onDragOver={(e) =>
                            !simpleAssignMode && handleDragOver(e)
                          }
                          onClick={() =>
                            simpleAssignMode &&
                            computer.status === "available" &&
                            handleSimpleAssign(computer.id)
                          }
                        >
                          {/* Selection Checkbox */}
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectComputer(
                                  computer.id,
                                  e.target.checked,
                                );
                              }}
                              className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                            />
                          </div>

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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  releaseComputer(computer.id);
                                }}
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
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-px bg-gray-600 flex-1"></div>
                  <h5 className="text-sm font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded">
                    📚 Middle Row
                  </h5>
                  <div className="h-px bg-gray-600 flex-1"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(5, 10)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      const isSelected = selectedComputers.has(computer.id);

                      return (
                        <div
                          key={computer.id}
                          data-computer-id={computer.id}
                          data-drop-target="true"
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 relative ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-900/30 ring-2 ring-indigo-500"
                              : draggedStudent &&
                                  computer.status === "available"
                                ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                                : computer.status === "available"
                                  ? "border-green-500 hover:border-green-400"
                                  : computer.status === "in_use"
                                    ? "border-blue-500"
                                    : "border-yellow-500"
                          }`}
                          onDrop={(e) =>
                            !simpleAssignMode && handleDrop(e, computer.id)
                          }
                          onDragOver={(e) =>
                            !simpleAssignMode && handleDragOver(e)
                          }
                          onClick={() =>
                            simpleAssignMode &&
                            computer.status === "available" &&
                            handleSimpleAssign(computer.id)
                          }
                        >
                          {/* Selection Checkbox */}
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectComputer(
                                  computer.id,
                                  e.target.checked,
                                );
                              }}
                              className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                            />
                          </div>

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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  releaseComputer(computer.id);
                                }}
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
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-px bg-gray-600 flex-1"></div>
                  <h5 className="text-sm font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded">
                    🪑 Back Row (Farthest from Instructor)
                  </h5>
                  <div className="h-px bg-gray-600 flex-1"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 justify-center">
                  {getComputersByClassroom(selectedLab)
                    .slice(10, 15)
                    .map((computer) => {
                      const assignment = getAssignmentForComputer(computer.id);
                      const isSelected = selectedComputers.has(computer.id);

                      return (
                        <div
                          key={computer.id}
                          data-computer-id={computer.id}
                          data-drop-target="true"
                          className={`border-2 rounded-lg p-4 bg-gray-900 transition-all duration-200 relative ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-900/30 ring-2 ring-indigo-500"
                              : draggedStudent &&
                                  computer.status === "available"
                                ? "border-blue-500 bg-blue-900/30 shadow-lg scale-105"
                                : computer.status === "available"
                                  ? "border-green-500 hover:border-green-400"
                                  : computer.status === "in_use"
                                    ? "border-blue-500"
                                    : "border-yellow-500"
                          }`}
                          onDrop={(e) =>
                            !simpleAssignMode && handleDrop(e, computer.id)
                          }
                          onDragOver={(e) =>
                            !simpleAssignMode && handleDragOver(e)
                          }
                          onClick={() =>
                            simpleAssignMode &&
                            computer.status === "available" &&
                            handleSimpleAssign(computer.id)
                          }
                        >
                          {/* Selection Checkbox */}
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectComputer(
                                  computer.id,
                                  e.target.checked,
                                );
                              }}
                              className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                            />
                          </div>

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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  releaseComputer(computer.id);
                                }}
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
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-gray-800 border-gray-700">
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
                  <label htmlFor="lab-computers-room-select" className="block text-sm font-medium text-gray-300 mb-2">
                    Select Lab Room
                  </label>
                  <select
                    id="lab-computers-room-select"
                    name="selectedClassroom"
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
                  <label htmlFor="lab-computers-count" className="block text-sm font-medium text-gray-300 mb-2">
                    Number of Computers
                  </label>
                  <input
                    id="lab-computers-count"
                    name="computerCount"
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

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={() => setShowAddComputers(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addComputers}
                    disabled={processing === "add-computers"}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium w-full sm:w-auto"
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

      {/* Smart Assignment Modal */}
      {showSmartAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-gray-800 border-gray-700">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  Smart Assignment
                </h3>
                <button
                  onClick={() => setShowSmartAssignModal(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="lab-computers-smart-session" className="block text-sm font-medium text-gray-300 mb-2">
                    Select Class Session
                  </label>
                  <select
                    id="lab-computers-smart-session"
                    name="smartAssignSessionId"
                    value={smartAssignSessionId || ""}
                    onChange={(e) =>
                      setSmartAssignSessionId(parseInt(e.target.value) || null)
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Choose a session...</option>
                    {/* For now, we'll simulate session selection */}
                    <option value="1">
                      Current Session - Lab {selectedLab}
                    </option>
                  </select>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-300">
                    Assignment Methods:
                  </h4>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => handleSmartAssignment("performance")}
                      disabled={
                        processing === "smart-assign-performance" ||
                        !smartAssignSessionId
                      }
                      className="flex items-center p-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      <div className="text-2xl mr-3">🏆</div>
                      <div className="text-left">
                        <div className="font-medium">Performance-Based</div>
                        <div className="text-xs opacity-90">
                          Assign high performers to optimal positions
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSmartAssignment("learning-style")}
                      disabled={
                        processing === "smart-assign-learning-style" ||
                        !smartAssignSessionId
                      }
                      className="flex items-center p-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      <div className="text-2xl mr-3">🧠</div>
                      <div className="text-left">
                        <div className="font-medium">Learning Style</div>
                        <div className="text-xs opacity-90">
                          Match positions to learning preferences
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSmartAssignment("conflict-free")}
                      disabled={
                        processing === "smart-assign-conflict-free" ||
                        !smartAssignSessionId
                      }
                      className="flex items-center p-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      <div className="text-2xl mr-3">🤝</div>
                      <div className="text-left">
                        <div className="font-medium">Conflict-Free</div>
                        <div className="text-xs opacity-90">
                          Avoid seating conflicts and distractions
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSmartAssignment("random")}
                      disabled={
                        processing === "smart-assign-random" ||
                        !smartAssignSessionId
                      }
                      className="flex items-center p-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      <div className="text-2xl mr-3">🎲</div>
                      <div className="text-left">
                        <div className="font-medium">Random Assignment</div>
                        <div className="text-xs opacity-90">
                          Simple random distribution
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={() => setShowSmartAssignModal(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-gray-800 border-gray-700">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  Computer Maintenance Management
                </h3>
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Maintenance Records Table */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h4 className="text-md font-medium text-white mb-4">
                    Maintenance History
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Computer
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Scheduled
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Completed
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {maintenanceRecords.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-gray-400"
                            >
                              No maintenance records found
                            </td>
                          </tr>
                        ) : (
                          maintenanceRecords.map((record: any) => (
                            <tr
                              key={record.maintenance.id}
                              className="hover:bg-gray-800"
                            >
                              <td className="px-4 py-3 text-sm text-white">
                                {record.computer.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-300">
                                {record.maintenance.maintenanceType}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    record.maintenance.status === "completed"
                                      ? "bg-green-900 text-green-300"
                                      : record.maintenance.status ===
                                          "in_progress"
                                        ? "bg-blue-900 text-blue-300"
                                        : "bg-yellow-900 text-yellow-300"
                                  }`}
                                >
                                  {record.maintenance.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-300">
                                {record.maintenance.scheduledDate
                                  ? new Date(
                                      record.maintenance.scheduledDate,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-300">
                                {record.maintenance.completedDate
                                  ? new Date(
                                      record.maintenance.completedDate,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-sm space-x-2">
                                {record.maintenance.status === "scheduled" && (
                                  <button className="text-blue-400 hover:text-blue-300">
                                    Start
                                  </button>
                                )}
                                {record.maintenance.status ===
                                  "in_progress" && (
                                  <button className="text-green-400 hover:text-green-300">
                                    Complete
                                  </button>
                                )}
                                <button className="text-gray-400 hover:text-gray-300">
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Schedule New Maintenance */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h4 className="text-md font-medium text-white mb-4">
                    Schedule New Maintenance
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="lab-computers-maintenance-computer" className="block text-sm font-medium text-gray-300 mb-2">
                        Computer
                      </label>
                      <select id="lab-computers-maintenance-computer" name="maintenanceComputer" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option>Select computer...</option>
                        {computers.map((computer) => (
                          <option key={computer.id} value={computer.id}>
                            {computer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="lab-computers-maintenance-type" className="block text-sm font-medium text-gray-300 mb-2">
                        Maintenance Type
                      </label>
                      <select id="lab-computers-maintenance-type" name="maintenanceType" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option>Preventive</option>
                        <option>Corrective</option>
                        <option>Upgrade</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="lab-computers-maintenance-date" className="block text-sm font-medium text-gray-300 mb-2">
                        Scheduled Date
                      </label>
                      <input
                        id="lab-computers-maintenance-date"
                        name="scheduledDate"
                        type="date"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="lab-computers-maintenance-description" className="block text-sm font-medium text-gray-300 mb-2">
                        Description
                      </label>
                      <input
                        id="lab-computers-maintenance-description"
                        name="maintenanceDescription"
                        type="text"
                        placeholder="Brief description"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium">
                      Schedule Maintenance
                    </button>
                  </div>
                </div>

                {/* Maintenance Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🔧</div>
                    <div className="text-lg font-bold text-white">
                      {
                        computers.filter((c) => c.status === "maintenance")
                          .length
                      }
                    </div>
                    <div className="text-sm text-gray-400">In Maintenance</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">📅</div>
                    <div className="text-lg font-bold text-white">
                      {
                        maintenanceRecords.filter(
                          (r: any) => r.maintenance.status === "scheduled",
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-400">Scheduled</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">⚡</div>
                    <div className="text-lg font-bold text-white">
                      {
                        maintenanceRecords.filter(
                          (r: any) => r.maintenance.status === "in_progress",
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-400">In Progress</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="text-lg font-bold text-white">
                      {
                        maintenanceRecords.filter(
                          (r: any) => r.maintenance.status === "completed",
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-400">Completed</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
