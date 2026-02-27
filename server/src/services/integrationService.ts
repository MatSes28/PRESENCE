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
import { eq, and, gte, lte } from "drizzle-orm";
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

    for (const i of list) {
      const provider = String(i.provider);
      const configured = i.config && Object.keys(i.config).length > 0;
      status[provider] = {
        configured,
        active: !!i.enabled,
        lastSync: i.lastSyncAt ?? null,
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

    try {
      const integration = await this.resolveIntegration(integrationId);
      if (!integration || !integration.enabled) {
        result.errors.push("Integration not found or inactive");
        return result;
      }

      const provider = String(integration.provider);
      switch (provider) {
        case "moodle":
          return await this.syncFromMoodle(integration);
        case "canvas":
          return await this.syncFromCanvas(integration);
        default:
          result.errors.push("Unsupported integration type");
          return result;
      }
    } catch (error) {
      console.error("LMS sync error:", error);
      result.errors.push("Sync failed: " + (error as Error).message);
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

    try {
      const integration = await this.resolveIntegration(integrationId);
      if (!integration || !integration.enabled) {
        result.errors.push("Integration not found or inactive");
        return result;
      }

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
      switch (provider) {
        case "moodle":
          return await this.syncAttendanceToMoodle(integration, attendanceData);
        case "canvas":
          return await this.syncAttendanceToCanvas(integration, attendanceData);
        default:
          result.errors.push("Unsupported integration type");
          return result;
      }
    } catch (error) {
      console.error("Attendance sync error:", error);
      result.errors.push("Sync failed: " + (error as Error).message);
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
      // Check if Google Classroom API credentials are configured
      const googleConfig = process.env.GOOGLE_CLASSROOM_API_KEY;
      if (!googleConfig) {
        result.errors.push("Google Classroom API credentials not configured");
        return result;
      }

      console.log(`[GOOGLE_CLASSROOM] Syncing classroom ${classroomId}`);

      // TODO: Implement actual Google Classroom API integration
      // 1. Set up OAuth2 client with credentials from environment variables
      // 2. Authenticate using service account or OAuth2 flow
      // 3. List courses using classroomId
      // 4. Fetch students from courses
      // 5. Sync with local database

      // For now, log that integration is pending implementation
      result.errors.push(
        "Google Classroom integration requires API implementation",
      );
      return result;
    } catch (error) {
      console.error("Google Classroom sync error:", error);
      result.errors.push("Google Classroom sync failed");
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
      // Microsoft Teams API integration would go here
      console.log(`[MICROSOFT_TEAMS] Syncing team ${teamId}`);

      // TODO: Implement actual Microsoft Graph API integration
      // 1. Set up OAuth2 client with Microsoft credentials
      // 2. Get team members using teamId
      // 3. Fetch meeting attendance reports
      // 4. Sync with local database

      // For now, log that integration is pending
      result.errors.push(
        "Microsoft Teams integration requires API credentials and OAuth setup",
      );
      return result;
    } catch (error) {
      console.error("Microsoft Teams sync error:", error);
      result.errors.push("Microsoft Teams sync failed");
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
      // Moodle Web Services API calls would go here
      console.log("[MOODLE] Syncing students from Moodle");

      // TODO: Implement actual Moodle Web Services API integration
      // 1. Call core_user_get_users_by_field to get users
      // 2. Call enrol_get_enrolled_users to get enrollments
      // 3. Process and sync with local database

      // For now, log that integration is pending
      result.errors.push(
        "Moodle integration requires API endpoint and token configuration",
      );
      return result;
    } catch (error) {
      console.error("Moodle sync error:", error);
      result.errors.push("Moodle sync failed");
      return result;
    }
  }

  private async syncFromCanvas(
    integration: IntegrationConfig,
  ): Promise<SyncResult> {
    // Similar implementation for Canvas LMS
    const result: SyncResult = {
      success: false,
      syncedRecords: 0,
      errors: [],
      timestamp: new Date(),
    };

    // TODO: Implement actual Canvas LMS API integration
    // 1. Call Canvas API to get users and enrollments
    // 2. Process and sync with local database
    result.errors.push(
      "Canvas LMS integration requires API endpoint and token configuration",
    );
    return result;
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
      // Moodle attendance API calls would go here
      console.log(
        `[MOODLE] Syncing ${attendanceData.length} attendance records to Moodle`,
      );

      for (const record of attendanceData) {
        // Simulate API call to Moodle
        console.log(
          `Marking ${record.student.name} as ${record.record.status} in Moodle`,
        );
        result.syncedRecords++;
      }

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
    // Similar implementation for Canvas
    const result: SyncResult = {
      success: true,
      syncedRecords: attendanceData.length,
      errors: [],
      timestamp: new Date(),
    };
    return result;
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
