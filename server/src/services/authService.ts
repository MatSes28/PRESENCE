import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import crypto from "crypto";
import { db } from "../storage.js";
import { users } from "../schema.js";
import { eq, and, lt, sql } from "drizzle-orm";

// Temporary interface for user sessions until schema is updated
interface UserSession {
  id: number;
  sessionId: string;
  userId: number;
  ipAddress: string;
  userAgent: string | null;
  deviceFingerprint: string | null;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface LoginAttempt {
  userId: number;
  ipAddress: string;
  userAgent: string;
  successful: boolean;
  timestamp: Date;
  reason?: string;
}

interface SessionInfo {
  sessionId: string;
  userId: number;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  deviceFingerprint?: string;
}

class AuthService {
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private bcryptRounds = 12;
  private maxLoginAttempts = 5;
  private lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-jwt-secret-change-in-production";
    this.jwtRefreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      "fallback-refresh-secret-change-in-production";
  }

  // Password hashing
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // JWT token generation
  generateAccessToken(userId: number, role: string): string {
    return jwt.sign(
      {
        userId,
        role,
        type: "access",
        iat: Math.floor(Date.now() / 1000),
      },
      this.jwtSecret,
      { expiresIn: "1h" }
    );
  }

  generateRefreshToken(userId: number): string {
    return jwt.sign(
      {
        userId,
        type: "refresh",
        iat: Math.floor(Date.now() / 1000),
      },
      this.jwtRefreshSecret,
      { expiresIn: "7d" }
    );
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtRefreshSecret);
    } catch (error) {
      return null;
    }
  }

  // Two-Factor Authentication
  generateTwoFactorSecret(userEmail: string): TwoFactorSetup {
    const secret = speakeasy.generateSecret({
      name: `CLIRDEC:PRESENCE (${userEmail})`,
      issuer: "CLIRDEC:PRESENCE",
    });

    const qrCodeUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `CLIRDEC:PRESENCE (${userEmail})`,
      issuer: "CLIRDEC:PRESENCE",
      encoding: "ascii",
    });

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }

    return {
      secret: secret.ascii,
      qrCodeUrl,
      backupCodes,
    };
  }

  async generateQRCode(qrCodeUrl: string): Promise<string> {
    try {
      return await qrcode.toDataURL(qrCodeUrl);
    } catch (error) {
      throw new Error("Failed to generate QR code");
    }
  }

  verifyTwoFactorCode(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: "ascii",
      token,
      window: 2, // Allow 2 time steps (30 seconds) tolerance
    });
  }

  verifyBackupCode(storedCodes: string[], providedCode: string): boolean {
    const index = storedCodes.indexOf(providedCode);
    if (index !== -1) {
      // Remove used backup code
      storedCodes.splice(index, 1);
      return true;
    }
    return false;
  }

  // Advanced session management
  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string,
    deviceFingerprint?: string
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    // Store session in database using raw SQL
    await db.execute(sql`
      INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, device_fingerprint, expires_at, is_active)
      VALUES (${sessionId}, ${userId}, ${ipAddress}, ${userAgent}, ${
      deviceFingerprint || null
    }, ${expiresAt}, true)
    `);

    return sessionId;
  }

  async validateSession(sessionId: string): Promise<SessionInfo | null> {
    // Simplified implementation - in production, this would query the database
    // For now, return a mock session for demonstration
    return {
      sessionId,
      userId: 1,
      ipAddress: "127.0.0.1",
      userAgent: "Mock User Agent",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      isActive: true,
      deviceFingerprint: "mock-fingerprint",
    };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    // Simplified implementation - in production, this would update the database
    console.log(`Invalidating session: ${sessionId}`);
  }

  async invalidateAllUserSessions(userId: number): Promise<void> {
    // Simplified implementation - in production, this would update the database
    console.log(`Invalidating all sessions for user: ${userId}`);
  }

  async getActiveSessions(userId: number): Promise<SessionInfo[]> {
    // Simplified implementation - in production, this would query the database
    return [
      {
        sessionId: "mock-session-id",
        userId,
        ipAddress: "127.0.0.1",
        userAgent: "Mock User Agent",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        isActive: true,
        deviceFingerprint: "mock-fingerprint",
      },
    ];
  }

  // Login attempt tracking and account lockout
  async recordLoginAttempt(attempt: LoginAttempt): Promise<void> {
    // In a real implementation, you'd store this in a login_attempts table
    // For now, we'll use a simple in-memory approach with Redis
    const key = `login_attempts:${attempt.userId}`;
    // This would be implemented with Redis increment operations
    console.log(
      `Login attempt recorded for user ${attempt.userId}: ${
        attempt.successful ? "success" : "failed"
      }`
    );
  }

  async isAccountLocked(userId: number): Promise<boolean> {
    // Check if user has exceeded max login attempts
    // Implementation would check Redis for recent failed attempts
    return false; // Placeholder
  }

  async getRemainingLoginAttempts(userId: number): Promise<number> {
    // Return remaining attempts before lockout
    return this.maxLoginAttempts; // Placeholder
  }

  // Password policy enforcement
  validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Password change tracking
  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate all existing sessions for security
    await this.invalidateAllUserSessions(userId);
  }

  // Security event logging
  async logSecurityEvent(
    eventType: string,
    userId: number | null,
    details: any,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // In a real implementation, this would be stored in a security_events table
    const event = {
      eventType,
      userId,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };

    console.log("Security Event:", event);
    // TODO: Store in database for audit trail
  }

  // Suspicious activity detection
  async detectSuspiciousActivity(
    userId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    // Check for unusual login patterns
    // - Different IP than usual
    // - Different device fingerprint
    // - Unusual time of access
    // - Geographic anomalies

    // Placeholder implementation
    return false;
  }

  // Device fingerprinting
  generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${userAgent}:${ipAddress}:${Date.now()}`)
      .digest("hex");

    return fingerprint.substring(0, 16); // Short fingerprint
  }
}

export const authService = new AuthService();
