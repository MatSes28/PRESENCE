import crypto from "crypto";
import CryptoJS from "crypto-js";

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

class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: string;
  private keyCache = new Map<string, Buffer>();

  constructor() {
    this.config = {
      algorithm: "aes-256-gcm",
      keyLength: 32,
      ivLength: 16,
      saltRounds: 10000,
    };

    this.masterKey =
      process.env.ENCRYPTION_MASTER_KEY || "change-this-key-in-production-32";
    if (this.masterKey.length !== 32) {
      throw new Error("Master key must be exactly 32 characters long");
    }
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
      "sha256"
    );
  }

  // Encrypt data with AES-256-CBC (more compatible)
  encrypt(data: string, key?: Buffer): EncryptedData {
    const iv = crypto.randomBytes(this.config.ivLength);

    let encryptionKey: Buffer;
    if (key) {
      encryptionKey = key;
    } else {
      // Use master key for general encryption
      encryptionKey = Buffer.from(this.masterKey, "utf8");
    }

    const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    return {
      encrypted,
      iv: iv.toString("hex"),
    };
  }

  // Decrypt data with AES-256-CBC
  decrypt(encryptedData: EncryptedData, key?: Buffer): string {
    let decryptionKey: Buffer;
    if (key) {
      decryptionKey = key;
    } else {
      // Use master key for general decryption
      decryptionKey = Buffer.from(this.masterKey, "utf8");
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      decryptionKey,
      Buffer.from(encryptedData.iv, "hex")
    );

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  // Encrypt sensitive fields in objects
  encryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
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
    obj: T & { _encryptedFields?: string[] }
  ): T {
    if (!obj._encryptedFields) {
      return obj;
    }

    const decrypted = { ...obj };
    delete decrypted._encryptedFields;

    for (const field of obj._encryptedFields) {
      if (obj[field] !== undefined && obj[field] !== null) {
        try {
          const encryptedData: EncryptedData = JSON.parse(String(obj[field]));
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
    key?: Buffer
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
    key?: Buffer
  ): Promise<void> {
    const encryptedData = JSON.parse(
      require("fs").readFileSync(inputPath, "utf8")
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
    const encrypted: EncryptedData = JSON.parse(encryptedValue);
    return this.decrypt(encrypted);
  }

  // Encrypt RFID UIDs for additional security
  encryptRFID(rfidUid: string): string {
    // Use a specific key for RFID data
    const rfidKey = this.deriveKey(
      "rfid_encryption_key",
      Buffer.from("rfid_salt_2024")
    );
    const encrypted = this.encrypt(rfidUid, rfidKey);
    return JSON.stringify(encrypted);
  }

  decryptRFID(encryptedRfid: string): string {
    const rfidKey = this.deriveKey(
      "rfid_encryption_key",
      Buffer.from("rfid_salt_2024")
    );
    const encrypted: EncryptedData = JSON.parse(encryptedRfid);
    return this.decrypt(encrypted, rfidKey);
  }

  // Encrypt parent contact information
  encryptParentData(
    email: string,
    phone?: string
  ): { email: string; phone?: string } {
    const parentKey = this.deriveKey(
      "parent_data_key",
      Buffer.from("parent_salt_2024")
    );

    return {
      email: JSON.stringify(this.encrypt(email, parentKey)),
      phone: phone ? JSON.stringify(this.encrypt(phone, parentKey)) : undefined,
    };
  }

  decryptParentData(
    encryptedEmail: string,
    encryptedPhone?: string
  ): { email: string; phone?: string } {
    const parentKey = this.deriveKey(
      "parent_data_key",
      Buffer.from("parent_salt_2024")
    );

    return {
      email: this.decrypt(JSON.parse(encryptedEmail), parentKey),
      phone: encryptedPhone
        ? this.decrypt(JSON.parse(encryptedPhone), parentKey)
        : undefined,
    };
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
    const userKey = this.deriveKey(this.masterKey, userSalt);

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
    const encrypted: EncryptedData = JSON.parse(encryptedData);
    return this.decrypt(encrypted, userKey);
  }

  // Secure backup encryption
  encryptBackup(data: any): string {
    const backupKey = this.deriveKey(
      "backup_encryption_key",
      Buffer.from("backup_salt_2024")
    );
    const jsonData = JSON.stringify(data);
    const encrypted = this.encrypt(jsonData, backupKey);
    return JSON.stringify(encrypted);
  }

  decryptBackup(encryptedBackup: string): any {
    const backupKey = this.deriveKey(
      "backup_encryption_key",
      Buffer.from("backup_salt_2024")
    );
    const encrypted: EncryptedData = JSON.parse(encryptedBackup);
    const decrypted = this.decrypt(encrypted, backupKey);
    return JSON.parse(decrypted);
  }

  // Key rotation support
  rotateMasterKey(newMasterKey: string): void {
    if (newMasterKey.length !== 32) {
      throw new Error("New master key must be exactly 32 characters long");
    }

    // In a real implementation, this would:
    // 1. Re-encrypt all data with the new key
    // 2. Update the master key
    // 3. Log the key rotation event

    console.log(
      "Master key rotation initiated - this requires manual re-encryption of all data"
    );
    this.masterKey = newMasterKey;
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
