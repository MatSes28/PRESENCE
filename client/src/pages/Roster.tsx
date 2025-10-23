import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  year: number;
  section: string;
}

export const Roster: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadRoster();
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      const response = await api.get("/subjects");
      setSubjects(response.data);
    } catch (error) {
      console.error("Failed to load subjects:", error);
    }
  };

  const loadRoster = async () => {
    if (!selectedSubject) return;

    setLoading(true);
    try {
      // Simplified: students belong to subjects directly, no separate enrollment tracking
      const response = await api.get(`/subjects/${selectedSubject}/students`);
      setStudents(response.data);
    } catch (error) {
      console.error("Failed to load roster:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // Simplified: no complex enrollment management, just view rosters
  const canManageEnrollments = false;

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Class Roster</h2>

        {/* Subject Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Choose a subject...</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
        </div>

        {/* Roster Table */}
        {selectedSubject && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-400">
                Loading roster...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No students enrolled in this subject
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Section
                    </th>
                    {canManageEnrollments && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {student.studentId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {student.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {student.section}
                      </td>
                      {canManageEnrollments && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          <button className="text-red-400 hover:text-red-300">
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Print Button */}
        {selectedSubject && students.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              Print Class List
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
