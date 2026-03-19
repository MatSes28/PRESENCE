import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createRequire } from "module";
import { authService } from "../../../src/services/authService.js";
import db from "../../../src/storage.js";

const require = createRequire(import.meta.url);

describe("AuthService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (db as any).execute = jest.fn();
  });

  describe("Password policy", () => {
    it("accepts strong password", () => {
      const result = authService.validatePasswordStrength("StrongPass123!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects weak password", () => {
      const result = authService.validatePasswordStrength("weak");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Token operations", () => {
    it("generates access token", () => {
      const token = authService.generateAccessToken(1, "admin");
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(10);
    });

    it("verifies invalid access token as null", () => {
      const result = authService.verifyAccessToken("not-a-valid-token");
      expect(result).toBeNull();
    });
  });

  describe("Two-factor", () => {
    it("generates secret and backup codes", () => {
      const setup = authService.generateTwoFactorSecret("test@example.com");
      expect(typeof setup.secret).toBe("string");
      expect(setup.secret.length).toBeGreaterThan(0);
      expect(typeof setup.qrCodeUrl).toBe("string");
      expect(setup.backupCodes).toHaveLength(8);
    });

    it("verifies backup code and removes it", () => {
      const codes = ["ABC123", "DEF456"];
      const ok = authService.verifyBackupCode(codes, "ABC123");
      expect(ok).toBe(true);
      expect(codes).toEqual(["DEF456"]);
    });

    it("returns wrapped error when QR generation fails", async () => {
      const qrcode = require("qrcode");
      jest.spyOn(qrcode, "toDataURL").mockRejectedValue(new Error("bad qr"));

      await expect(
        authService.generateQRCode("otpauth://test"),
      ).rejects.toThrow("Failed to generate QR code");
    });
  });

  describe("Session and profile helpers", () => {
    it("creates session with generated id", async () => {
      (db as any).execute.mockResolvedValue(undefined);
      const sessionId = await authService.createSession(
        1,
        "127.0.0.1",
        "test-agent",
      );

      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(10);
      expect((db as any).execute).toHaveBeenCalled();
    });

    it("returns null for missing session", async () => {
      (db as any).select = jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }));

      const result = await authService.validateSession("missing");
      expect(result).toBeNull();
    });

    it("returns deterministic 16-char fingerprint", () => {
      const fp = authService.generateDeviceFingerprint("Chrome", "192.168.1.1");
      expect(typeof fp).toBe("string");
      expect(fp).toHaveLength(16);
    });
  });
});
