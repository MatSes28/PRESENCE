# Multi-Factor Authentication (MFA) Design

## Overview

This document outlines the design for implementing Multi-Factor Authentication (MFA) in the CLIRDEC:PRESENCE system.

## MFA Methods Supported

### 1. Time-based One-Time Password (TOTP)

- **Description**: Uses authenticator apps (Google Authenticator, Authy, etc.)
- **Pros**: No SMS costs, works offline, industry standard
- **Cons**: Requires smartphone with authenticator app

### 2. SMS-Based OTP (Future)

- **Description**: One-time codes sent via SMS
- **Pros**: No additional apps required
- **Cons**: SMS delivery issues, costs, less secure than TOTP

### 3. Email-Based OTP (Fallback)

- **Description**: One-time codes sent via email
- **Pros**: Uses existing email infrastructure
- **Cons**: Slower than TOTP, potential email delivery issues

## Database Schema Extensions

### User MFA Settings Table

```sql
CREATE TABLE user_mfa_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  mfa_method VARCHAR(20) NOT NULL, -- 'totp', 'sms', 'email'
  totp_secret VARCHAR(255), -- Encrypted TOTP secret
  backup_codes TEXT[], -- Encrypted backup codes
  phone_number VARCHAR(20), -- For SMS MFA
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### MFA Verification Attempts Table

```sql
CREATE TABLE mfa_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  attempt_type VARCHAR(20) NOT NULL, -- 'setup', 'login', 'recovery'
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## Implementation Phases

### Phase 1: TOTP Implementation

1. **Setup Endpoint**: Generate TOTP secret and QR code
2. **Verification Endpoint**: Verify TOTP codes during setup
3. **Login Integration**: Require TOTP after password verification
4. **Backup Codes**: Generate and store encrypted backup codes

### Phase 2: Recovery Options

1. **Backup Code Login**: Allow login with backup codes
2. **Admin Override**: Allow admins to disable MFA for users
3. **Recovery Flow**: Guided recovery process

### Phase 3: Additional Methods

1. **SMS Integration**: Implement SMS-based OTP
2. **Email Fallback**: Email-based verification

## Security Considerations

### TOTP Secret Encryption

- TOTP secrets must be encrypted at rest
- Use AES-256-GCM encryption
- Store encryption keys securely (AWS KMS, HashiCorp Vault, or similar)

### Rate Limiting

- Limit MFA verification attempts (5 per 5 minutes)
- Lock out after excessive failures
- Log all MFA-related security events

### Backup Codes

- Generate 10 backup codes during setup
- Encrypt and store securely
- Single-use codes (mark as used after consumption)
- Allow regeneration with proper verification

## API Endpoints

### MFA Setup

```
POST /api/auth/mfa/setup
- Generate TOTP secret
- Return QR code URL and secret

POST /api/auth/mfa/verify-setup
- Verify TOTP code during setup
- Enable MFA for user

POST /api/auth/mfa/disable
- Disable MFA (requires current password + TOTP)
```

### MFA Login

```
POST /api/auth/login
- Existing login flow
- If MFA enabled, return MFA required response

POST /api/auth/mfa/verify
- Verify TOTP code for login
- Return authentication token
```

### Recovery

```
POST /api/auth/mfa/recovery
- Verify backup code
- Return authentication token

POST /api/auth/mfa/regenerate-backup
- Regenerate backup codes (requires MFA verification)
```

## Frontend Integration

### Login Flow

1. User enters email/password
2. Server validates credentials
3. If MFA enabled, return MFA challenge
4. Frontend displays TOTP input
5. User enters TOTP code
6. Complete authentication

### Setup Flow

1. User enables MFA in settings
2. Display QR code for authenticator app
3. User scans QR code
4. User enters verification code
5. MFA enabled, backup codes displayed

## Libraries Required

### Backend

- `speakeasy`: TOTP generation and verification
- `qrcode`: QR code generation
- `crypto`: Encryption for secrets/codes

### Frontend

- `qrcode.react`: Display QR codes
- React components for TOTP input

## Migration Strategy

1. **Add MFA tables** via database migration
2. **Deploy MFA endpoints** with feature flags
3. **Enable MFA for admins first**
4. **Gradual rollout to all users**
5. **Provide grace period** for MFA adoption

## Compliance Considerations

- **ISO 27001**: MFA helps meet authentication requirements
- **GDPR**: Secure storage of MFA data
- **Audit Logging**: All MFA events must be logged
- **User Consent**: Clear opt-in process for MFA

## Future Enhancements

1. **Hardware Security Keys** (FIDO2/WebAuthn)
2. **Push Notifications** via mobile apps
3. **Biometric Integration**
4. **Risk-based Authentication**
5. **MFA for API Access**

## Implementation Priority

1. **High**: TOTP implementation
2. **Medium**: Backup codes and recovery
3. **Low**: SMS/Email MFA, advanced features

This design provides a solid foundation for MFA implementation while maintaining security best practices and user experience.
