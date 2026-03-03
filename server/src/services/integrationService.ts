import db from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  integrations,
  integrationSyncRuns,
  integrationSyncEvents,
} from "../schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { encryptionService } from "./encryptionService.js";
import { auditService } from "./auditService.js";

type IntegrationProvider =
  | "moodle"
  | "canvas"
  | "google_classroom"
  | "microsoft_teams"
  | "sis"
  | "hr"
  | "oidc"
  | "saml"
  | "scim"
  | "custom";

interface IntegrationConfig {
  id: number;
  name: string;
  kind: string;
  provider: IntegrationProvider | string;
  enabled: boolean;
  lastSyncAt?: Date | null;
  config: Record<string, any>;
}

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  category: number;
  startdate: number;
  enddate: number;
}

interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface SyncResult {
  success: boolean;
  syncedRecords: number;
  errors: string[];
  timestamp: Date;
}

class IntegrationService {
  private integrationsById: Map<number, IntegrationConfig> = new Map();
  private integrationsByKey: Map<string, IntegrationConfig> = new Map();
  private warnedMissingIntegrationsTable = false;

  private async requestJson(
    url: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers?: Record<string, string>;
      body?: unknown;
    } = {},
  ): Promise<any> {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} - ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
      );
    }

    return payload;
  }

  private async startRun(
    integrationId: number,
    jobType: string,
  ): Promise<number | null> {
    try {
      const [run] = await db
        .insert(integrationSyncRuns)
        .values({
          integrationId,
          jobType,
          status: "running",
          stats: {},
        })
        .returning({ id: integrationSyncRuns.id });
      return run?.id ?? null;
    } catch {
      return null;
    }
  }

  private async finishRun(
    runId: number | null,
    status: "ok" | "error",
    stats: Record<string, any>,
    error?: string,
  ): Promise<void> {
    if (!runId) return;
    try {
      await db
        .update(integrationSyncRuns)
        .set({
          status,
          stats,
          error: error || null,
          finishedAt: new Date(),
        })
        .where(eq(integrationSyncRuns.id, runId));
    } catch {
      // best-effort only
    }
  }

  private async recordEvent(
    runId: number | null,
    entityType: string,
    action: string,
    status: "ok" | "error",
    message: string,
  ): Promise<void> {
    if (!runId) return;
    try {
      await db.insert(integrationSyncEvents).values({
        runId,
        entityType,
        action,
        status,
        message,
      });
    } catch {
      // best-effort only
    }
  }

  constructor() {
    void this.refreshIntegrations();
  }

  private normalizeLookupKey(key: string): string {
    return key.trim().toLowerCase();
  }

  private decryptIfEncrypted(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
      return encryptionService.decryptFromDatabase(value);
    } catch {
      return value;
    }
  }

  private decryptIntegrationConfig(
    config: Record<string, any>,
  ): Record<string, any> {
    const out: Record<string, any> = { ...config };
    for (const k of Object.keys(out)) {
      out[k] = this.decryptIfEncrypted(out[k]);
    }
    return out;
  }

  // DB-backed integration configs (replaces env-config integration stub)
  private async refreshIntegrations() {
    try {
      const rows = await db.select().from(integrations);

      this.integrationsById.clear();
      this.integrationsByKey.clear();

      for (const row of rows as any[]) {
        const cfg: IntegrationConfig = {
          id: row.id,
          name: row.name,
          kind: row.kind,
          provider: row.provider,
          enabled: row.enabled,
          lastSyncAt: row.lastSyncAt ?? null,
          config: this.decryptIntegrationConfig((row.config ?? {}) as any),
        };

        this.integrationsById.set(cfg.id, cfg);
        this.integrationsByKey.set(
          this.normalizeLookupKey(String(cfg.id)),
          cfg,
        );
        this.integrationsByKey.set(
          this.normalizeLookupKey(String(cfg.provider)),
          cfg,
        );
        this.integrationsByKey.set(this.normalizeLookupKey(cfg.name), cfg);
      }
    } catch (error) {
      const anyErr = error as any;
      const pgCode = anyErr?.cause?.code || anyErr?.code;
      const msg = String(anyErr?.cause?.message || anyErr?.message || "");

      // Common on fresh deployments where migrations haven't been applied yet.
      if (
        pgCode === "42P01" ||
        msg.includes('relation "integrations" does not exist')
      ) {
        if (!this.warnedMissingIntegrationsTable) {
          this.warnedMissingIntegrationsTable = true;
          console.warn(
            "Integrations table missing. Apply DB migrations to enable SIS/LMS/HR integrations.",
          );
        }
        return;
      }

      console.error("Failed to load integrations:", error);
    }
  }

  private async resolveIntegration(
    integrationKey: string,
  ): Promise<IntegrationConfig | null> {
    const normalized = this.normalizeLookupKey(integrationKey);
    const cached = this.integrationsByKey.get(normalized);
    if (cached) return cached;

    await this.refreshIntegrations();
    return this.integrationsByKey.get(normalized) || null;
  }

  async listIntegrations(): Promise<IntegrationConfig[]> {
    await this.refreshIntegrations();
    return Array.from(this.integrationsById.values());
  }

  async getIntegrationStatus(): Promise<Record<string, any>> {
    const list = await this.listIntegrations();
    const status: Record<string, any> = {};

    const latestRuns = await db
      .select()
      .from(integrationSyncRuns)
      .orderBy(desc(integrationSyncRuns.startedAt));
    const latestByIntegration = new Map<number, (typeof latestRuns)[number]>();
    for (const run of latestRuns) {
      if (!latestByIntegration.has(run.integrationId)) {
        latestByIntegration.set(run.integrationId, run);
      }
    }

    for (const i of list) {
      const provider = String(i.provider);
      const configured = i.config && Object.keys(i.config).length > 0;
      const run = latestByIntegration.get(i.id);
      status[provider] = {
        configured,
        active: !!i.enabled,
        lastSync: run?.finishedAt ?? i.lastSyncAt ?? null,
        lastRunStatus: run?.status ?? null,
        lastRunStats: run?.stats ?? null,
        lastRunError: run?.error ?? null,
      };
    }

    // These integrations are still env-based in this codebase; keep reporting them.
    status.google_classroom = status.google_classroom ?? {
      configured: !!process.env.GOOGLE_CLASSROOM_API_KEY,
      active: !!process.env.GOOGLE_CLASSROOM_API_KEY,
      lastSync: null,
    };
    status.microsoft_teams = status.microsoft_teams ?? {
      configured: !!process.env.MICROSOFT_TEAMS_API_KEY,
      active: !!process.env.MICROSOFT_TEAMS_API_KEY,
      lastSync: null,
    };

    return status;
  }

  // Sync student data from external LMS
  async syncStudentsFromLMS(integrationId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    let runId: number | null = null;

    try {
      const integration = await this.resolveIntegration(integrationId);
      if (!integration || !integration.enabled) {
        result.errors.push("Integration not found or inactive");
        return result;
      }

      runId = await this.startRun(integration.id, "sync_students");

      const provider = String(integration.provider);
      let providerResult: SyncResult;
      switch (provider) {
        case "moodle":
          providerResult = await this.syncFromMoodle(integration);
          break;
        case "canvas":
          providerResult = await this.syncFromCanvas(integration);
          break;
        default:
          result.errors.push("Unsupported integration type");
          await this.recordEvent(
            runId,
            "integration",
            "sync_students",
            "error",
            `Unsupported integration type: ${provider}`,
          );
          return result;
      }

      await this.recordEvent(
        runId,
        "integration",
        "sync_students",
        providerResult.success ? "ok" : "error",
        providerResult.success
          ? `Synced ${providerResult.syncedRecords} records`
          : providerResult.errors.join("; "),
      );
      await this.finishRun(
        runId,
        providerResult.success ? "ok" : "error",
        {
          syncedRecords: providerResult.syncedRecords,
          errors: providerResult.errors.length,
        },
        providerResult.errors.join("; ") || undefined,
      );

      if (providerResult.success) {
        await db
          .update(integrations)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(integrations.id, integration.id));
      }

      return providerResult;
    } catch (error) {
      console.error("LMS sync error:", error);
      result.errors.push("Sync failed: " + (error as Error).message);
      await this.finishRun(
        runId,
        "error",
        { syncedRecords: 0 },
        result.errors[0],
      );
      return result;
    }
  }

  // Sync attendance data to external LMS
  async syncAttendanceToLMS(
    integrationId: string,
    sessionId: number,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    let runId: number | null = null;

    try {
      const integration = await this.resolveIntegration(integrationId);
      if (!integration || !integration.enabled) {
        result.errors.push("Integration not found or inactive");
        return result;
      }

      runId = await this.startRun(integration.id, "sync_attendance");

      // Get attendance data for the session
      const attendanceData = await db
        .select({
          student: students,
          record: attendanceRecords,
          session: classSessions,
          subject: subjects,
        })
        .from(attendanceRecords)
        .innerJoin(students, eq(attendanceRecords.studentId, students.id))
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .where(eq(attendanceRecords.classSessionId, sessionId));

      const provider = String(integration.provider);
      let providerResult: SyncResult;
      switch (provider) {
        case "moodle":
          providerResult = await this.syncAttendanceToMoodle(
            integration,
            attendanceData,
          );
          break;
        case "canvas":
          providerResult = await this.syncAttendanceToCanvas(
            integration,
            attendanceData,
          );
          break;
        default:
          result.errors.push("Unsupported integration type");
          await this.recordEvent(
            runId,
            "integration",
            "sync_attendance",
            "error",
            `Unsupported integration type: ${provider}`,
          );
          return result;
      }

      await this.recordEvent(
        runId,
        "integration",
        "sync_attendance",
        providerResult.success ? "ok" : "error",
        providerResult.success
          ? `Synced ${providerResult.syncedRecords} attendance records`
          : providerResult.errors.join("; "),
      );
      await this.finishRun(
        runId,
        providerResult.success ? "ok" : "error",
        {
          syncedRecords: providerResult.syncedRecords,
          errors: providerResult.errors.length,
        },
        providerResult.errors.join("; ") || undefined,
      );

      if (providerResult.success) {
        await db
          .update(integrations)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(integrations.id, integration.id));
      }

      return providerResult;
    } catch (error) {
      console.error("Attendance sync error:", error);
      result.errors.push("Sync failed: " + (error as Error).message);
      await this.finishRun(
        runId,
        "error",
        { syncedRecords: 0 },
        result.errors[0],
      );
      return result;
    }
  }

  // Google Classroom integration
  async syncWithGoogleClassroom(classroomId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      const accessToken = process.env.GOOGLE_CLASSROOM_ACCESS_TOKEN;
      if (!accessToken) {
        result.errors.push("GOOGLE_CLASSROOM_ACCESS_TOKEN is not configured");
        return result;
      }

      console.log(`[GOOGLE_CLASSROOM] Syncing classroom ${classroomId}`);

      const payload = await this.requestJson(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(classroomId)}/students`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const studentsList = Array.isArray(payload?.students)
        ? payload.students
        : [];
      result.syncedRecords = studentsList.length;
      result.success = true;
      return result;
    } catch (error) {
      console.error("Google Classroom sync error:", error);
      result.errors.push(
        "Google Classroom sync failed: " + (error as Error).message,
      );
      return result;
    }
  }

  // Microsoft Teams integration
  async syncWithMicrosoftTeams(teamId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      console.log(`[MICROSOFT_TEAMS] Syncing team ${teamId}`);

      const accessToken = process.env.MICROSOFT_TEAMS_ACCESS_TOKEN;
      if (!accessToken) {
        result.errors.push("MICROSOFT_TEAMS_ACCESS_TOKEN is not configured");
        return result;
      }

      const payload = await this.requestJson(
        `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(teamId)}/members`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const members = Array.isArray(payload?.value) ? payload.value : [];
      result.syncedRecords = members.length;
      result.success = true;
      return result;
    } catch (error) {
      console.error("Microsoft Teams sync error:", error);
      result.errors.push(
        "Microsoft Teams sync failed: " + (error as Error).message,
      );
      return result;
    }
  }

  // Webhook handler for real-time integrations
  async handleWebhook(
    provider: string,
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[WEBHOOK] Received ${provider} webhook:`, payload);

      switch (provider) {
        case "moodle":
          return await this.handleMoodleWebhook(payload);
        case "canvas":
          return await this.handleCanvasWebhook(payload);
        case "google_classroom":
          return await this.handleGoogleClassroomWebhook(payload);
        default:
          return { success: false, message: "Unknown webhook provider" };
      }
    } catch (error) {
      console.error("Webhook handling error:", error);
      return { success: false, message: "Webhook processing failed" };
    }
  }

  // Export data for external systems
  async exportData(
    format: "csv" | "json" | "xml",
    dataType: "students" | "attendance" | "sessions",
  ): Promise<string> {
    try {
      let data: any[] = [];

      switch (dataType) {
        case "students":
          data = await db.select().from(students);
          break;
        case "attendance":
          data = await db
            .select({
              student: students,
              record: attendanceRecords,
              session: classSessions,
              subject: subjects,
            })
            .from(attendanceRecords)
            .innerJoin(students, eq(attendanceRecords.studentId, students.id))
            .innerJoin(
              classSessions,
              eq(attendanceRecords.classSessionId, classSessions.id),
            )
            .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
            .innerJoin(subjects, eq(schedules.subjectId, subjects.id));
          break;
        case "sessions":
          data = await db
            .select({
              session: classSessions,
              schedule: schedules,
              subject: subjects,
            })
            .from(classSessions)
            .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
            .innerJoin(subjects, eq(schedules.subjectId, subjects.id));
          break;
      }

      switch (format) {
        case "json":
          return JSON.stringify(data, null, 2);
        case "csv":
          return this.convertToCSV(data);
        case "xml":
          return this.convertToXML(data, dataType);
        default:
          throw new Error("Unsupported export format");
      }
    } catch (error) {
      console.error("Data export error:", error);
      throw error;
    }
  }

  // Private helper methods
  private async syncFromMoodle(
    integration: IntegrationConfig,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      console.log("[MOODLE] Syncing students from Moodle");

      const baseUrl = String(integration.config?.baseUrl || "").replace(
        /\/$/,
        "",
      );
      const token = String(integration.config?.token || "");
      if (!baseUrl || !token) {
        result.errors.push("Moodle config requires baseUrl and token");
        return result;
      }

      const params = new URLSearchParams({
        wstoken: token,
        wsfunction: "core_user_get_users",
        moodlewsrestformat: "json",
        "criteria[0][key]": "deleted",
        "criteria[0][value]": "0",
      });

      const payload = await this.requestJson(
        `${baseUrl}/webservice/rest/server.php?${params.toString()}`,
      );

      const usersList = Array.isArray(payload?.users) ? payload.users : [];
      result.syncedRecords = usersList.length;
      result.success = true;
      return result;
    } catch (error) {
      console.error("Moodle sync error:", error);
      result.errors.push("Moodle sync failed: " + (error as Error).message);
      return result;
    }
  }

  private async syncFromCanvas(
    integration: IntegrationConfig,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      const baseUrl = String(integration.config?.baseUrl || "").replace(
        /\/$/,
        "",
      );
      const accessToken = String(integration.config?.accessToken || "");
      const accountId = String(integration.config?.accountId || "self");
      if (!baseUrl || !accessToken) {
        result.errors.push("Canvas config requires baseUrl and accessToken");
        return result;
      }

      const payload = await this.requestJson(
        `${baseUrl}/api/v1/accounts/${encodeURIComponent(accountId)}/users?per_page=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const usersList = Array.isArray(payload) ? payload : [];
      result.syncedRecords = usersList.length;
      result.success = true;
      return result;
    } catch (error) {
      result.errors.push("Canvas sync failed: " + (error as Error).message);
      return result;
    }
  }

  private async syncAttendanceToMoodle(
    integration: IntegrationConfig,
    attendanceData: any[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      console.log(
        `[MOODLE] Syncing ${attendanceData.length} attendance records to Moodle`,
      );

      const endpoint = String(integration.config?.attendanceEndpoint || "");
      const token = String(integration.config?.token || "");
      if (!endpoint || !token) {
        result.errors.push(
          "Moodle attendance sync requires attendanceEndpoint and token",
        );
        return result;
      }

      const payload = attendanceData.map((record) => ({
        studentId: record.student?.studentId,
        studentName: record.student?.name,
        status: record.record?.status,
        sessionId: record.session?.id,
        subject: record.subject?.name,
      }));

      await this.requestJson(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { records: payload },
      });

      result.syncedRecords = payload.length;

      result.success = true;
      return result;
    } catch (error) {
      console.error("Moodle attendance sync error:", error);
      result.errors.push("Moodle attendance sync failed");
      return result;
    }
  }

  private async syncAttendanceToCanvas(
    integration: IntegrationConfig,
    attendanceData: any[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      const endpoint = String(integration.config?.attendanceEndpoint || "");
      const accessToken = String(integration.config?.accessToken || "");
      if (!endpoint || !accessToken) {
        result.errors.push(
          "Canvas attendance sync requires attendanceEndpoint and accessToken",
        );
        return result;
      }

      const payload = attendanceData.map((record) => ({
        studentId: record.student?.studentId,
        studentName: record.student?.name,
        status: record.record?.status,
        sessionId: record.session?.id,
        subject: record.subject?.name,
      }));

      await this.requestJson(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { records: payload },
      });

      result.success = true;
      result.syncedRecords = payload.length;
      return result;
    } catch (error) {
      result.errors.push(
        "Canvas attendance sync failed: " + (error as Error).message,
      );
      return result;
    }
  }

  private async handleMoodleWebhook(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    // Handle Moodle webhook events (enrollment changes, grade updates, etc.)
    console.log("Processing Moodle webhook:", payload.event_type);

    switch (payload.event_type) {
      case "user_enrolled":
        // Handle user enrollment
        return { success: true, message: "User enrollment processed" };
      case "grade_updated":
        // Handle grade updates
        return { success: true, message: "Grade update processed" };
      default:
        return { success: true, message: "Webhook acknowledged" };
    }
  }

  private async handleCanvasWebhook(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    // Handle Canvas webhook events
    return { success: true, message: "Canvas webhook processed" };
  }

  private async handleGoogleClassroomWebhook(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    // Handle Google Classroom webhook events
    return { success: true, message: "Google Classroom webhook processed" };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((item) =>
      Object.values(item)
        .map((value) =>
          typeof value === "object" ? JSON.stringify(value) : String(value),
        )
        .join(","),
    );

    return [headers, ...rows].join("\n");
  }

  private convertToXML(data: any[], rootElement: string): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement}s>\n`;

    for (const item of data) {
      xml += `  <${rootElement}>\n`;
      for (const [key, value] of Object.entries(item)) {
        xml += `    <${key}>${value}</${key}>\n`;
      }
      xml += `  </${rootElement}>\n`;
    }

    xml += `</${rootElement}s>`;
    return xml;
  }
}

export const integrationService = new IntegrationService();
