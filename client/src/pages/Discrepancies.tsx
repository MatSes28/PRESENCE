import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../components/NotificationSystem";

type DiscrepancyRow = {
  record: {
    id: number;
    studentId: number;
    classSessionId: number;
    entryTime?: string | null;
    exitTime?: string | null;
    status?: string | null;
    rfidDetected: boolean;
    sensorDetected: boolean;
    isValid: boolean;
    discrepancyFlag: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  student: {
    id: number;
    studentId: string;
    name: string;
    email?: string | null;
  };
  session: {
    id: number;
    date: string;
    status: string;
  };
  schedule: {
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    semester: string;
    academicYear: string;
  };
  subject: { id: number; code: string; name: string };
  classroom: { id: number; name: string; location: string };
  faculty: { id: number; name: string; email: string };
};

type EvidenceResponse = {
  record: any;
  student: any;
  window: { startDate: string; endDate: string };
  nearestRfid: any | null;
  sensorEvents: any[];
  deviceId: string | null;
};

export const Discrepancies: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });

  const [filters, setFilters] = useState({
    status: "open" as "open" | "resolved" | "all",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const canBulkResolve = user?.role === "admin";
  const selectedCount = selectedIds.size;

  // Evidence modal
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [evidenceRecordId, setEvidenceRecordId] = useState<number | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pagination.limit));
    params.set("offset", String(pagination.offset));
    params.set("status", filters.status);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    return params.toString();
  }, [pagination.limit, pagination.offset, filters]);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await api.get<{ data: DiscrepancyRow[] }>(
        `/discrepancies?${queryString}`,
      );

      // Server returns `{ success: true, data: DiscrepancyRow[] }`
      const raw = (resp as any)?.data;
      setRows(Array.isArray(raw) ? (raw as DiscrepancyRow[]) : []);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error("Failed to load discrepancies:", err);
      addNotification({
        type: "error",
        title: "Load failed",
        message: err?.message || "Failed to load discrepancies",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) return setSelectedIds(new Set());
    const next = new Set<number>();
    for (const r of rows) next.add(r.record.id);
    setSelectedIds(next);
  };

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openEvidence = async (recordId: number) => {
    setEvidenceOpen(true);
    setEvidenceRecordId(recordId);
    setEvidence(null);
    setEvidenceLoading(true);
    try {
      const resp = await api.get(`/discrepancies/${recordId}/evidence`);
      const payload = (resp as any)?.data;
      setEvidence(payload as EvidenceResponse);
    } catch (err: any) {
      console.error("Failed to load evidence:", err);
      addNotification({
        type: "error",
        title: "Evidence load failed",
        message: err?.message || "Failed to load evidence",
      });
    } finally {
      setEvidenceLoading(false);
    }
  };

  const bulkResolve = async (resolution: "validate" | "excuse") => {
    if (!canBulkResolve || selectedIds.size === 0) return;
    const reason = window.prompt(
      resolution === "validate"
        ? "Validation note (optional)"
        : "Excuse reason (optional)",
      "",
    );
    try {
      await api.post("/discrepancies/bulk-resolve", {
        recordIds: Array.from(selectedIds.values()),
        resolution,
        reason: reason ?? undefined,
      });
      addNotification({
        type: "success",
        title: "Bulk action complete",
        message: `Resolved ${selectedIds.size} records`,
      });
      await load();
    } catch (err: any) {
      console.error("Bulk resolve failed:", err);
      addNotification({
        type: "error",
        title: "Bulk resolve failed",
        message: err?.message || "Bulk resolve failed",
      });
    }
  };

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Discrepancies</h2>
          <p className="text-sm text-gray-300">
            Review and resolve anomaly records with evidence (RFID + sensor +
            device health)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div>
            <label
              htmlFor="discrepancy-status"
              className="block text-xs text-gray-400 mb-1"
            >
              Status
            </label>
            <select
              id="discrepancy-status"
              name="discrepancy-status"
              value={filters.status}
              onChange={(e) => {
                setPagination((p) => ({ ...p, offset: 0 }));
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as any,
                }));
              }}
              className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="discrepancy-start"
              className="block text-xs text-gray-400 mb-1"
            >
              Start
            </label>
            <input
              id="discrepancy-start"
              name="discrepancy-start"
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setPagination((p) => ({ ...p, offset: 0 }));
                setFilters((f) => ({ ...f, startDate: e.target.value }));
              }}
              className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="discrepancy-end"
              className="block text-xs text-gray-400 mb-1"
            >
              End
            </label>
            <input
              id="discrepancy-end"
              name="discrepancy-end"
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setPagination((p) => ({ ...p, offset: 0 }));
                setFilters((f) => ({ ...f, endDate: e.target.value }));
              }}
              className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
            />
          </div>
          <button
            onClick={() => load()}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {canBulkResolve && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between bg-gray-800 border border-gray-700 rounded p-3">
          <div className="text-sm text-gray-200">
            Selected: <span className="font-semibold">{selectedCount}</span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={selectedCount === 0}
              onClick={() => bulkResolve("validate")}
              className="disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
            >
              Validate
            </button>
            <button
              disabled={selectedCount === 0}
              onClick={() => bulkResolve("excuse")}
              className="disabled:opacity-50 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded"
            >
              Excuse
            </button>
            <button
              disabled={selectedCount === 0}
              onClick={() => setSelectedIds(new Set())}
              className="disabled:opacity-50 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-950">
              <tr>
                {canBulkResolve && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <input
                      aria-label="Select all"
                      type="checkbox"
                      checked={hasRows && selectedIds.size === rows.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Course / Room
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Signal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={canBulkResolve ? 7 : 6}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canBulkResolve ? 7 : 6}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No discrepancies found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const rec = r.record;
                  const badge = rec.discrepancyFlag
                    ? "bg-yellow-900 text-yellow-200"
                    : "bg-green-900 text-green-200";
                  return (
                    <tr key={rec.id} className="hover:bg-gray-950">
                      {canBulkResolve && (
                        <td className="px-4 py-4">
                          <input
                            aria-label={`Select record ${rec.id}`}
                            type="checkbox"
                            checked={selectedIds.has(rec.id)}
                            onChange={(e) =>
                              toggleSelect(rec.id, e.target.checked)
                            }
                          />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="text-white font-medium">
                          {r.student.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {r.student.studentId}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white">
                          {r.subject.code} — {r.classroom.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {r.classroom.location}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${badge}`}>
                          {rec.discrepancyFlag ? "OPEN" : "RESOLVED"}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">
                          RFID: {rec.rfidDetected ? "yes" : "no"} · Sensor:{" "}
                          {rec.sensorDetected ? "yes" : "no"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-300 max-w-md">
                        {rec.notes || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-300 whitespace-nowrap">
                        {new Date(rec.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openEvidence(rec.id)}
                          className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm"
                        >
                          Evidence
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          disabled={pagination.offset === 0}
          onClick={() =>
            setPagination((p) => ({
              ...p,
              offset: Math.max(0, p.offset - p.limit),
            }))
          }
          className="disabled:opacity-50 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Prev
        </button>
        <div className="text-sm text-gray-400">
          Offset {pagination.offset} · Limit {pagination.limit}
        </div>
        <button
          disabled={rows.length < pagination.limit}
          onClick={() =>
            setPagination((p) => ({
              ...p,
              offset: p.offset + p.limit,
            }))
          }
          className="disabled:opacity-50 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Next
        </button>
      </div>

      {evidenceOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div>
                <div className="text-white font-semibold">Evidence</div>
                <div className="text-xs text-gray-400">
                  Record #{evidenceRecordId}
                </div>
              </div>
              <button
                onClick={() => setEvidenceOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              {evidenceLoading ? (
                <div className="text-gray-300">Loading evidence…</div>
              ) : !evidence ? (
                <div className="text-gray-400">No evidence available.</div>
              ) : (
                <>
                  <div className="bg-gray-950 border border-gray-800 rounded p-3">
                    <div className="text-sm text-gray-200 font-medium">
                      Nearest RFID_SCAN
                    </div>
                    <pre className="mt-2 text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(evidence.nearestRfid, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-gray-950 border border-gray-800 rounded p-3">
                    <div className="text-sm text-gray-200 font-medium">
                      SENSOR_TRIGGER events (same device)
                    </div>
                    <pre className="mt-2 text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(evidence.sensorEvents, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
