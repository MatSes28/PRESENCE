import { authService } from "../../../src/services/authService";

// Mock external dependencies
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("speakeasy", () => ({
  generateSecret: jest.fn(),
  otpauthURL: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));

jest.mock("qrcode", () => ({
  toDataURL: jest.fn(),
}));

jest.mock("crypto", () => ({
  randomBytes: jest.fn(),
  randomUUID: jest.fn(),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => "mockedhash"),
    })),
  })),
}));

// Mock database operations
jest.mock("../../../src/storage.js", () => ({
  db: {
    execute: jest.fn(),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => []),
          orderBy: jest.fn(() => []),
        })),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => []),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => []),
      })),
    })),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Password Operations", () => {
    it("should hash password successfully", async () => {
      const mockHash = require("bcryptjs").hash;
      mockHash.mockResolvedValue("hashedPassword");

      const result = await authService.hashPassword("testPassword");

      expect(mockHash).toHaveBeenCalledWith("testPassword", 12);
      expect(result).toBe("hashedPassword");
    });

    it("should verify password correctly", async () => {
      const mockCompare = require("bcryptjs").compare;
      mockCompare.mockResolvedValue(true);

      const result = await authService.verifyPassword("password", "hash");

      expect(mockCompare).toHaveBeenCalledWith("password", "hash");
      expect(result).toBe(true);
    });

    it("should validate strong password", () => {
      const result = authService.validatePasswordStrength("StrongPass123!");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject weak password", () => {
      const result = authService.validatePasswordStrength("weak");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must be at least 8 characters long"
      );
    });
  });

  describe("JWT Token Operations", () => {
    it("should generate access token", () => {
      const mockSign = require("jsonwebtoken").sign;
      mockSign.mockReturnValue("accessToken");

      const token = authService.generateAccessToken(1, "admin");

      expect(mockSign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          role: "admin",
          type: "access",
        }),
        expect.any(String),
        { expiresIn: "1h" }
      );
      expect(token).toBe("accessToken");
    });

    it("should generate refresh token", () => {
      const mockSign = require("jsonwebtoken").sign;
      mockSign.mockReturnValue("refreshToken");

      const token = authService.generateRefreshToken(1);

      expect(mockSign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "refresh",
        }),
        expect.any(String),
        { expiresIn: "7d" }
      );
      expect(token).toBe("refreshToken");
    });

    it("should verify valid access token", () => {
      const mockVerify = require("jsonwebtoken").verify;
      mockVerify.mockReturnValue({ userId: 1, role: "admin" });

      const result = authService.verifyAccessToken("validToken");

      expect(mockVerify).toHaveBeenCalledWith("validToken", expect.any(String));
      expect(result.userId).toBe(1);
    });

    it("should return null for invalid access token", () => {
      const mockVerify = require("jsonwebtoken").verify;
      mockVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = authService.verifyAccessToken("invalidToken");

      expect(result).toBe(null);
    });
  });

  describe("Two-Factor Authentication", () => {
    it("should generate 2FA secret", () => {
      const mockGenerateSecret = require("speakeasy").generateSecret;
      mockGenerateSecret.mockReturnValue({
        ascii: "secret123",
      });

      const mockOtpAuth = require("speakeasy").otpauthURL;
      mockOtpAuth.mockReturnValue("otpauth://totp/test");

      const mockRandomBytes = require("crypto").randomBytes;
      mockRandomBytes.mockReturnValue(Buffer.from("abcd"));

      const result = authService.generateTwoFactorSecret("test@example.com");

      expect(result.secret).toBe("secret123");
      expect(result.qrCodeUrl).toBe("otpauth://totp/test");
      expect(result.backupCodes).toHaveLength(8);
    });

    it("should generate QR code", async () => {
      const mockToDataURL = require("qrcode").toDataURL;
      mockToDataURL.mockResolvedValue("data:image/png;base64,abc123");

      const result = await authService.generateQRCode("otpauth://totp/test");

      expect(mockToDataURL).toHaveBeenCalledWith("otpauth://totp/test");
      expect(result).toBe("data:image/png;base64,abc123");
    });

    it("should verify valid 2FA code", () => {
      const mockVerify = require("speakeasy").totp.verify;
      mockVerify.mockReturnValue(true);

      const result = authService.verifyTwoFactorCode("secret", "123456");

      expect(mockVerify).toHaveBeenCalledWith({
        secret: "secret",
        encoding: "ascii",
        token: "123456",
        window: 2,
      });
      expect(result).toBe(true);
    });

    it("should verify backup code", () => {
      const storedCodes = ["ABC123", "DEF456"];

      const result = authService.verifyBackupCode(storedCodes, "ABC123");

      expect(result).toBe(true);
      expect(storedCodes).toHaveLength(1); // Code should be removed
      expect(storedCodes).not.toContain("ABC123");
    });
  });

  describe("Session Management", () => {
    it("should create session successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockResolvedValue(undefined);

      const mockRandomUUID = require("crypto").randomUUID;
      mockRandomUUID.mockReturnValue("session-123");

      const sessionId = await authService.createSession(
        1,
        "192.168.1.1",
        "Chrome"
      );

      expect(mockExecute).toHaveBeenCalled();
      expect(sessionId).toBe("session-123");
    });

    it("should validate active session", async () => {
      const mockSelect = require("../../../src/storage.js").db.select;
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                sessionId: "session-123",
                userId: 1,
                ipAddress: "192.168.1.1",
                userAgent: "Chrome",
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 3600000),
                isActive: true,
                deviceFingerprint: "fp123",
              },
            ],
          }),
        }),
      });

      const result = await authService.validateSession("session-123");

      expect(result).not.toBe(null);
      expect(result?.sessionId).toBe("session-123");
      expect(result?.userId).toBe(1);
    });

    it("should return null for invalid session", async () => {
      const mockSelect = require("../../../src/storage.js").db.select;
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      });

      const result = await authService.validateSession("invalid-session");

      expect(result).toBe(null);
    });

    it("should invalidate session", async () => {
      const mockUpdate = require("../../../src/storage.js").db.update;
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => [],
          }),
        }),
      });

      await expect(
        authService.invalidateSession("session-123")
      ).resolves.not.toThrow();
    });

    it("should get active sessions", async () => {
      const mockSelect = require("../../../src/storage.js").db.select;
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => [
              {
                sessionId: "session-123",
                userId: 1,
                ipAddress: "192.168.1.1",
                userAgent: "Chrome",
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 3600000),
                isActive: true,
                deviceFingerprint: "fp123",
              },
            ],
          }),
        }),
      });

      const sessions = await authService.getActiveSessions(1);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe("session-123");
    });
  });

  describe("Password Update", () => {
    it("should update password and invalidate sessions", async () => {
      const mockHash = require("bcryptjs").hash;
      mockHash.mockResolvedValue("newHash");

      const mockUpdate = require("../../../src/storage.js").db.update;
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => [],
          }),
        }),
      });

      await expect(
        authService.updatePassword(1, "newPassword")
      ).resolves.not.toThrow();

      expect(mockHash).toHaveBeenCalledWith("newPassword", 12);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("Device Fingerprinting", () => {
    it("should generate device fingerprint", () => {
      const fingerprint = authService.generateDeviceFingerprint(
        "Chrome",
        "192.168.1.1"
      );

      expect(fingerprint).toBe("mockedhash".substring(0, 16));
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors during session creation", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Database error"));

      await expect(
        authService.createSession(1, "192.168.1.1", "Chrome")
      ).rejects.toThrow("Database error");
    });

    it("should handle QR code generation errors", async () => {
      const mockToDataURL = require("qrcode").toDataURL;
      mockToDataURL.mockRejectedValue(new Error("QR generation failed"));

      await expect(authService.generateQRCode("url")).rejects.toThrow(
        "Failed to generate QR code"
      );
    });
  });
});
