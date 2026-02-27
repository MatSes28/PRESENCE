import crypto from "crypto";
import { isProductionLike } from "../config/env.js";

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltRounds: number;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt?: string;
  authTag?: string;
}

type EncryptedEnvelopeV1 = {
  v: 1;
  alg: "aes-256-gcm";
  k: string;
  iv: string; // base64
  ct: string; // base64
  tag: string; // base64
  aad?: string; // base64
};

type AnyEncryptedPayload = EncryptedEnvelopeV1 | EncryptedData;

class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;
  private keyCache = new Map<string, Buffer>();

  constructor() {
    this.config = {
      algorithm: "aes-256-gcm",
      keyLength: 32,
      // 96-bit nonce is the recommended IV size for GCM.
      ivLength: 12,
      saltRounds: 10000,
    };

    // Primary config is ENCRYPTION_MASTER_KEY.
    // ENCRYPTION_KEY is a deprecated alias kept for backward compatibility with older deployments.
    const raw = process.env.ENCRYPTION_MASTER_KEY ?? process.env.ENCRYPTION_KEY;
    if (!raw) {
      if (isProductionLike()) {
        // In production-like environments, this must be set and validated by env validation.
        throw new Error(
          "Missing ENCRYPTION_MASTER_KEY (required in production-like environments)",
        );
      }

      // Development/test convenience: generate an ephemeral key.
      // WARNING: encrypted data will not be decryptable across restarts.
      this.masterKey = crypto.randomBytes(this.config.keyLength);
      console.warn(
        "⚠️  ENCRYPTION_MASTER_KEY is not set; using ephemeral in-memory key (dev only)",
      );
      return;
    }

    const envName = process.env.ENCRYPTION_MASTER_KEY
      ? "ENCRYPTION_MASTER_KEY"
      : "ENCRYPTION_KEY";
    this.masterKey = this.parse32ByteKeyFromEnv(raw, envName);
  }

  private parse32ByteKeyFromEnv(raw: string, envName: string): Buffer {
    const trimmed = raw.trim();
    const lowered = trimmed.toLowerCase();

    if (
      lowered.includes("change-this") ||
      lowered.includes("please-change") ||
      lowered.includes("dev-")
    ) {
      throw new Error(
        `${envName} looks like a placeholder/dev value; generate a strong 32-byte key.`,
      );
    }

    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      return Buffer.from(trimmed, "hex");
    }

    const buf = Buffer.from(trimmed, "base64");
    if (buf.length !== 32) {
      throw new Error(
        `${envName} must be a 32-byte key encoded as base64 (recommended) or 64-char hex.`,
      );
    }
    return buf;
  }

  private hkdfKey(info: string): Buffer {
    const cacheKey = `hkdf_${info}`;
    const cached = this.keyCache.get(cacheKey);
    if (cached) return cached;

    const salt = Buffer.from("presence:hkdf:v1", "utf8");
    const key = Buffer.from(
      crypto.hkdfSync(
        "sha256",
        this.masterKey,
        salt,
        Buffer.from(info, "utf8"),
        this.config.keyLength,
      ),
    );
    this.keyCache.set(cacheKey, key);
    return key;
  }

  private encryptGcm(
    data: Buffer,
    key: Buffer,
    aad?: Buffer,
  ): EncryptedEnvelopeV1 {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    if (aad) cipher.setAAD(aad);

    const ct = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      v: 1,
      alg: "aes-256-gcm",
      k: "master",
      iv: iv.toString("base64"),
      ct: ct.toString("base64"),
      tag: tag.toString("base64"),
      aad: aad ? aad.toString("base64") : undefined,
    };
  }

  private decryptGcm(
    payload: EncryptedEnvelopeV1,
    key: Buffer,
    aad?: Buffer,
  ): Buffer {
    const iv = Buffer.from(payload.iv, "base64");
    const ct = Buffer.from(payload.ct, "base64");
    const tag = Buffer.from(payload.tag, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    if (aad) decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  // Generate a secure random key
  generateKey(length: number = this.config.keyLength): Buffer {
    return crypto.randomBytes(length);
  }

  // Derive a key from password using PBKDF2
  deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.config.saltRounds,
      this.config.keyLength,
      "sha256",
    );
  }

  /**
   * Encrypt data with AES-256-GCM (AEAD).
   *
   * - Provides confidentiality + integrity.
   * - Returns a versioned envelope to support future migration/rotation.
   */
  encrypt(
    data: string,
    key?: Buffer,
    aadContext: string = "presence",
  ): EncryptedEnvelopeV1 {
    const encryptionKey = key ?? this.masterKey;
    const aad = Buffer.from(`v1:${aadContext}`, "utf8");
    const payload = this.encryptGcm(
      Buffer.from(data, "utf8"),
      encryptionKey,
      aad,
    );
    payload.k = key ? "custom" : "master";
    payload.aad = aad.toString("base64");
    return payload;
  }

  /**
   * Decrypt data.
   *
   * Supports:
   * - v1 AES-256-GCM envelopes (preferred)
   * - legacy AES-256-CBC objects { encrypted, iv } for backward compatibility
   */
  decrypt(
    encryptedData: AnyEncryptedPayload,
    key?: Buffer,
    aadContext: string = "presence",
  ): string {
    const decryptionKey = key ?? this.masterKey;

    // v1 envelope
    if ((encryptedData as any).v === 1) {
      const payload = encryptedData as EncryptedEnvelopeV1;
      const aad = Buffer.from(`v1:${aadContext}`, "utf8");
      const pt = this.decryptGcm(payload, decryptionKey, aad);
      return pt.toString("utf8");
    }

    // Legacy CBC fallback (no integrity). Keep only for decrypting existing data.
    const legacy = encryptedData as EncryptedData;
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      decryptionKey,
      Buffer.from(legacy.iv, "hex"),
    );
    let decrypted = decipher.update(legacy.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Encrypt sensitive fields in objects
  encryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[],
  ): T & { _encryptedFields: string[] } {
    const encrypted = { ...obj };
    const encryptedFields: string[] = [];

    for (const field of sensitiveFields) {
      if (obj[field] !== undefined && obj[field] !== null) {
        const encryptedData = this.encrypt(String(obj[field]));
        encrypted[field] = JSON.stringify(encryptedData) as any;
        encryptedFields.push(String(field));
      }
    }

    return {
      ...encrypted,
      _encryptedFields: encryptedFields,
    };
  }

  // Decrypt sensitive fields in objects
  decryptObject<T extends Record<string, any>>(
    obj: T & { _encryptedFields?: string[] },
  ): T {
    if (!obj._encryptedFields) {
      return obj;
    }

    const decrypted = { ...obj };
    delete decrypted._encryptedFields;

    for (const field of obj._encryptedFields) {
      if (obj[field] !== undefined && obj[field] !== null) {
        try {
          const encryptedData: AnyEncryptedPayload = JSON.parse(
            String(obj[field]),
          );
          (decrypted as any)[field] = this.decrypt(encryptedData);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Keep original encrypted value if decryption fails
        }
      }
    }

    return decrypted;
  }

  // Hash sensitive data (one-way)
  hashData(data: string, saltRounds: number = 12): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  // Generate secure tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  // Encrypt files
  async encryptFile(
    inputPath: string,
    outputPath: string,
    key?: Buffer,
  ): Promise<void> {
    const input = require("fs").readFileSync(inputPath);
    const encrypted = this.encrypt(input.toString("base64"), key);

    const encryptedData = JSON.stringify(encrypted, null, 2);
    require("fs").writeFileSync(outputPath, encryptedData);
  }

  // Decrypt files
  async decryptFile(
    inputPath: string,
    outputPath: string,
    key?: Buffer,
  ): Promise<void> {
    const encryptedData = JSON.parse(
      require("fs").readFileSync(inputPath, "utf8"),
    );
    const decrypted = this.decrypt(encryptedData, key);

    const buffer = Buffer.from(decrypted, "base64");
    require("fs").writeFileSync(outputPath, buffer);
  }

  // Database field encryption for sensitive data
  encryptForDatabase(value: string): string {
    const encrypted = this.encrypt(value);
    return JSON.stringify(encrypted);
  }

  decryptFromDatabase(encryptedValue: string): string {
    const encrypted: AnyEncryptedPayload = JSON.parse(encryptedValue);
    return this.decrypt(encrypted);
  }

  // Encrypt RFID UIDs for additional security
  encryptRFID(rfidUid: string): string {
    // Derive a sub-key from the master key (no hardcoded password/salt).
    const rfidKey = this.hkdfKey("rfid:at-rest");
    const encrypted = this.encrypt(rfidUid, rfidKey, "rfid");
    return JSON.stringify(encrypted);
  }

  decryptRFID(encryptedRfid: string): string {
    const encrypted: AnyEncryptedPayload = JSON.parse(encryptedRfid);

    // Prefer new key derivation.
    try {
      const rfidKey = this.hkdfKey("rfid:at-rest");
      return this.decrypt(encrypted, rfidKey, "rfid");
    } catch (err) {
      // Backward-compat: legacy hardcoded-derived key used by older deployments.
      const legacyKey = this.deriveKey(
        "rfid_encryption_key",
        Buffer.from("rfid_salt_2024"),
      );
      return this.decrypt(encrypted, legacyKey, "rfid");
    }
  }

  /**
   * Deterministic, non-reversible lookup token for RFID UIDs.
   *
   * Store this in a dedicated DB column (e.g. rfid_uid_hash) to enforce uniqueness
   * and enable lookups without ever storing plaintext UID.
   */
  hashRFIDUidForLookup(rfidUid: string): string {
    const normalized = rfidUid.trim();
    const key = this.hkdfKey("rfid:lookup-hmac");
    return crypto.createHmac("sha256", key).update(normalized).digest("hex");
  }

  // Encrypt parent contact information
  encryptParentData(
    email: string,
    phone?: string,
  ): { email: string; phone?: string } {
    const parentKey = this.hkdfKey("parent:at-rest");

    return {
      email: JSON.stringify(this.encrypt(email, parentKey, "parent")),
      phone: phone
        ? JSON.stringify(this.encrypt(phone, parentKey, "parent"))
        : undefined,
    };
  }

  decryptParentData(
    encryptedEmail: string,
    encryptedPhone?: string,
  ): { email: string; phone?: string } {
    const emailPayload: AnyEncryptedPayload = JSON.parse(encryptedEmail);
    const phonePayload: AnyEncryptedPayload | undefined = encryptedPhone
      ? JSON.parse(encryptedPhone)
      : undefined;

    // Prefer new key derivation.
    try {
      const parentKey = this.hkdfKey("parent:at-rest");
      return {
        email: this.decrypt(emailPayload, parentKey, "parent"),
        phone: phonePayload
          ? this.decrypt(phonePayload, parentKey, "parent")
          : undefined,
      };
    } catch (err) {
      // Backward-compat: legacy hardcoded-derived key used by older deployments.
      const legacyKey = this.deriveKey(
        "parent_data_key",
        Buffer.from("parent_salt_2024"),
      );

      return {
        email: this.decrypt(emailPayload, legacyKey, "parent"),
        phone: phonePayload
          ? this.decrypt(phonePayload, legacyKey, "parent")
          : undefined,
      };
    }
  }

  // Encrypt session data
  encryptSessionData(sessionData: any): string {
    return this.encryptForDatabase(JSON.stringify(sessionData));
  }

  decryptSessionData(encryptedSessionData: string): any {
    const decrypted = this.decryptFromDatabase(encryptedSessionData);
    return JSON.parse(decrypted);
  }

  // Generate encryption keys for users (for additional user-specific encryption)
  generateUserKey(userId: number): Buffer {
    const cacheKey = `user_key_${userId}`;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const userSalt = crypto
      .createHash("sha256")
      .update(`user_${userId}_salt`)
      .digest();
    // Derive per-user keys from the master key.
    const userKey = crypto.pbkdf2Sync(
      this.masterKey,
      userSalt,
      this.config.saltRounds,
      this.config.keyLength,
      "sha256",
    );

    this.keyCache.set(cacheKey, userKey);
    return userKey;
  }

  // Encrypt user-specific sensitive data
  encryptUserData(userId: number, data: string): string {
    const userKey = this.generateUserKey(userId);
    const encrypted = this.encrypt(data, userKey);
    return JSON.stringify(encrypted);
  }

  decryptUserData(userId: number, encryptedData: string): string {
    const userKey = this.generateUserKey(userId);
    const encrypted: AnyEncryptedPayload = JSON.parse(encryptedData);
    return this.decrypt(encrypted, userKey);
  }

  // Secure backup encryption
  encryptBackup(data: any): string {
    const backupKey = this.hkdfKey("backup:at-rest");
    const jsonData = JSON.stringify(data);
    const encrypted = this.encrypt(jsonData, backupKey, "backup");
    return JSON.stringify(encrypted);
  }

  decryptBackup(encryptedBackup: string): any {
    const encrypted: AnyEncryptedPayload = JSON.parse(encryptedBackup);

    // Prefer new key derivation.
    let decrypted: string;
    try {
      const backupKey = this.hkdfKey("backup:at-rest");
      decrypted = this.decrypt(encrypted, backupKey, "backup");
    } catch (err) {
      // Backward-compat: legacy hardcoded-derived key used by older deployments.
      const legacyKey = this.deriveKey(
        "backup_encryption_key",
        Buffer.from("backup_salt_2024"),
      );
      decrypted = this.decrypt(encrypted, legacyKey, "backup");
    }
    return JSON.parse(decrypted);
  }

  // Key rotation support
  rotateMasterKey(newMasterKey: string): void {
    const parsed = this.parse32ByteKeyFromEnv(
      newMasterKey,
      "NEW_ENCRYPTION_MASTER_KEY",
    );

    // In a real implementation, this would:
    // 1. Re-encrypt all data with the new key
    // 2. Update the master key
    // 3. Log the key rotation event

    console.log(
      "Master key rotation initiated - this requires manual re-encryption of all data",
    );
    this.masterKey = parsed;
    this.keyCache.clear(); // Clear cached keys
  }

  // Data sanitization for logs (remove sensitive data)
  sanitizeForLogging(data: any, sensitiveFields: string[] = []): any {
    const sanitized = { ...data };

    // Default sensitive fields
    const defaultSensitive = [
      "password",
      "rfidUid",
      "parentEmail",
      "parentPhone",
      "sessionToken",
      "apiKey",
      "secret",
      "token",
      "authToken",
    ];

    const allSensitive = [...defaultSensitive, ...sensitiveFields];

    for (const field of allSensitive) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  // Compliance: Data encryption verification
  async verifyEncryptionIntegrity(): Promise<{
    totalRecords: number;
    encryptedRecords: number;
    integrityCheck: boolean;
  }> {
    // In a real implementation, this would check a sample of encrypted records
    // to ensure they can be decrypted successfully

    return {
      totalRecords: 0,
      encryptedRecords: 0,
      integrityCheck: true,
    };
  }

  // Emergency decryption (for compliance/legal requirements)
  emergencyDecryptAllData(emergencyKey: string): void {
    // This would only be used in extreme circumstances
    // Requires special authorization and logging
    console.log("EMERGENCY DECRYPTION REQUESTED - REQUIRES AUTHORIZATION");
  }

  // Generate encryption report for compliance
  async generateEncryptionReport(): Promise<any> {
    return {
      encryptionAlgorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      lastKeyRotation: new Date().toISOString(), // Would be tracked in database
      encryptedFields: [
        "rfid_uid",
        "parent_email",
        "parent_phone",
        "session_data",
        "backup_data",
      ],
      complianceStatus: "compliant",
      lastIntegrityCheck: new Date().toISOString(),
    };
  }
}

export const encryptionService = new EncryptionService();
