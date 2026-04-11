import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";

interface Classroom {
  id: number;
  name: string;
  location: string;
  type: "lecture" | "laboratory";
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
}

const DEFAULT_LOCATION = "CLIRDEC Building";
const MAX_TOTAL_CLASSROOMS = 4;
const MAX_PER_TYPE = 2;

export const Classrooms = () => {
  const { addNotification } = useNotifications();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "lecture" | "laboratory">(
    "all",
  );
  const [formData, setFormData] = useState({
    name: "",
    type: "lecture" as "lecture" | "laboratory",
    capacity: "",
  });

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const lectureCount = classrooms.filter(
    (classroom) => classroom.type === "lecture",
  ).length;
  const laboratoryCount = classrooms.filter(
    (classroom) => classroom.type === "laboratory",
  ).length;

  const canAddMoreRooms = classrooms.length < MAX_TOTAL_CLASSROOMS;

  const filteredClassrooms = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return classrooms.filter((classroom) => {
      const matchesSearch =
        search.length === 0 ||
        classroom.name.toLowerCase().includes(search) ||
        classroom.location.toLowerCase().includes(search) ||
        classroom.type.toLowerCase().includes(search);

      const matchesType =
        typeFilter === "all" || classroom.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [classrooms, searchTerm, typeFilter]);

  const fetchClassrooms = async () => {
    try {
      const response = await api.getClassrooms();
      const raw = (response as any)?.data;

      if ((response as any)?.success && Array.isArray(raw)) {
        setClassrooms(raw as Classroom[]);
        return;
      }

      setClassrooms([]);
      addNotification({
        type: "error",
        title: "Failed to Load Rooms",
        message: (response as any)?.message || "Unable to fetch room data.",
      });
    } catch (error) {
      console.error("Failed to fetch classrooms:", error);
      setClassrooms([]);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to load rooms. Please check your connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "lecture",
      capacity: "",
    });
    setEditingClassroom(null);
    setShowForm(false);
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    const apiMessage = (error as any)?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }

    return fallback;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Room name is required.",
      });
      return false;
    }

    if (formData.capacity.trim()) {
      const capacity = Number(formData.capacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        addNotification({
          type: "error",
          title: "Validation Error",
          message: "Capacity must be a positive whole number.",
        });
        return false;
      }
    }

    if (!editingClassroom) {
      if (!canAddMoreRooms) {
        addNotification({
          type: "error",
          title: "Room Limit Reached",
          message: "Only 4 rooms can be created for CLIRDEC.",
        });
        return false;
      }

      if (formData.type === "lecture" && lectureCount >= MAX_PER_TYPE) {
        addNotification({
          type: "error",
          title: "Lecture Room Limit Reached",
          message: "Only 2 lecture rooms are allowed.",
        });
        return false;
      }

      if (formData.type === "laboratory" && laboratoryCount >= MAX_PER_TYPE) {
        addNotification({
          type: "error",
          title: "Laboratory Room Limit Reached",
          message: "Only 2 laboratory rooms are allowed.",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      location: editingClassroom?.location || DEFAULT_LOCATION,
      capacity: formData.capacity.trim()
        ? Number(formData.capacity.trim())
        : undefined,
    };

    try {
      if (editingClassroom) {
        await api.updateClassroom(editingClassroom.id, {
          name: payload.name,
          location: payload.location,
          capacity: payload.capacity,
        });

        addNotification({
          type: "success",
          title: "Room Updated",
          message: `${payload.name} was updated successfully.`,
        });
      } else {
        await api.createClassroom(payload);

        addNotification({
          type: "success",
          title: "Room Created",
          message: `${payload.name} was added successfully.`,
        });
      }

      await fetchClassrooms();
      resetForm();
    } catch (error) {
      console.error("Failed to save classroom:", error);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: getErrorMessage(error, "Failed to save room."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setFormData({
      name: classroom.name,
      type: classroom.type,
      capacity: classroom.capacity?.toString() || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (classroom: Classroom) => {
    if (
      !confirm(
        `Delete ${classroom.name}? This may affect schedules assigned to this room.`,
      )
    ) {
      return;
    }

    setDeletingId(classroom.id);

    try {
      await api.deleteClassroom(classroom.id);
      addNotification({
        type: "success",
        title: "Room Deleted",
        message: `${classroom.name} was removed successfully.`,
      });
      await fetchClassrooms();
    } catch (error) {
      console.error("Failed to delete classroom:", error);
      addNotification({
        type: "error",
        title: "Delete Failed",
        message: getErrorMessage(error, "Failed to delete room."),
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Room Management</h3>
          <p className="text-sm text-gray-300">
            Create and manage CLIRDEC lecture rooms and laboratories.
          </p>
        </div>

        <button
          onClick={() => {
            if (!canAddMoreRooms) {
              addNotification({
                type: "error",
                title: "Room Limit Reached",
                message: "All 4 room slots are already in use.",
              });
              return;
            }

            resetForm();
            setShowForm(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add Room
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Rooms</p>
          <p className="text-2xl font-semibold text-white">{classrooms.length}/4</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Lecture Rooms</p>
          <p className="text-2xl font-semibold text-white">{lectureCount}/2</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Laboratories</p>
          <p className="text-2xl font-semibold text-white">{laboratoryCount}/2</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Location</p>
          <p className="text-lg font-semibold text-white">{DEFAULT_LOCATION}</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="classrooms-search" className="block text-sm font-medium text-gray-300 mb-2">
              Search Rooms
            </label>
            <input
              id="classrooms-search"
              name="searchRooms"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by room name, type, or location"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label htmlFor="classrooms-type-filter" className="block text-sm font-medium text-gray-300 mb-2">
              Filter by Type
            </label>
            <select
              id="classrooms-type-filter"
              name="typeFilter"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as "all" | "lecture" | "laboratory",
                )
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="all">All Rooms</option>
              <option value="lecture">Lecture Rooms</option>
              <option value="laboratory">Laboratories</option>
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="text-lg font-medium text-white">
                {editingClassroom ? "Edit Room" : "Add New Room"}
              </h4>
              <p className="text-sm text-gray-400 mt-1">
                Rooms are restricted to the {DEFAULT_LOCATION} campus layout.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="classroom-form-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Room Name *
                </label>
                <input
                  id="classroom-form-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g. Room 101"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="classroom-form-type" className="block text-sm font-medium text-gray-300 mb-1">
                  Room Type *
                </label>
                <select
                  id="classroom-form-type"
                  name="type"
                  value={formData.type}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: event.target.value as "lecture" | "laboratory",
                    }))
                  }
                  disabled={Boolean(editingClassroom)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white disabled:opacity-60"
                >
                  <option value="lecture">Lecture</option>
                  <option value="laboratory">Laboratory</option>
                </select>
                {editingClassroom && (
                  <p className="text-xs text-gray-400 mt-1">
                    Room type is locked after creation to preserve room quotas.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="classroom-form-capacity" className="block text-sm font-medium text-gray-300 mb-1">
                  Capacity
                </label>
                <input
                  id="classroom-form-capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      capacity: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">
              <span className="font-medium text-white">Location:</span> {DEFAULT_LOCATION}
            </div>

            <div className="flex justify-end">
              <LoadingButton
                type="submit"
                loading={submitting}
                loadingText={editingClassroom ? "Saving..." : "Creating..."}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
              >
                {editingClassroom ? "Save Changes" : "Create Room"}
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400">Registered Rooms</h4>
          <p className="text-sm text-gray-300 mt-1">
            {filteredClassrooms.length} room{filteredClassrooms.length === 1 ? "" : "s"} shown
          </p>
        </div>

        {filteredClassrooms.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            No rooms found. Create your first room to assign schedules and devices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredClassrooms.map((classroom) => (
                  <tr key={classroom.id} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {classroom.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Room ID #{classroom.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          classroom.type === "lecture"
                            ? "bg-blue-900 text-blue-200"
                            : "bg-emerald-900 text-emerald-200"
                        }`}
                      >
                        {classroom.type === "lecture" ? "Lecture" : "Laboratory"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {classroom.capacity ?? "Not set"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {classroom.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEdit(classroom)}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          Edit
                        </button>
                        <LoadingButton
                          type="button"
                          loading={deletingId === classroom.id}
                          loadingText="Deleting..."
                          onClick={() => handleDelete(classroom)}
                          className="text-red-400 hover:text-red-300 disabled:opacity-60"
                        >
                          Delete
                        </LoadingButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
