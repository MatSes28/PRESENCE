# Penetration Testing Guidelines

## Overview

This document provides guidelines for conducting security assessments and penetration testing on the CLIRDEC:PRESENCE system.

## Testing Methodology

### 1. Reconnaissance

- **Passive Information Gathering**

  - DNS enumeration
  - WHOIS lookups
  - Public source intelligence (OSINT)
  - Social engineering reconnaissance

- **Active Information Gathering**
  - Port scanning (limited to authorized ports)
  - Service enumeration
  - Web application fingerprinting

### 2. Vulnerability Assessment

- **Web Application Testing**

  - OWASP Top 10 assessment
  - Authentication bypass attempts
  - Authorization testing
  - Session management testing
  - Input validation testing

- **API Testing**
  - REST API endpoint enumeration
  - Authentication token testing
  - Rate limiting bypass attempts
  - Parameter tampering

### 3. Exploitation (Authorized Only)

- **Web Application Exploitation**

  - SQL injection testing
  - Cross-site scripting (XSS)
  - Cross-site request forgery (CSRF)
  - File inclusion vulnerabilities

- **Authentication Testing**
  - Brute force attacks (controlled)
  - Password cracking attempts
  - Session hijacking
  - MFA bypass attempts

## Testing Environment

### Scope

- **In Scope**:

  - Web application frontend and backend
  - API endpoints
  - Authentication mechanisms
  - Session management
  - Database interactions

- **Out of Scope**:
  - Physical security testing
  - Social engineering (except digital)
  - Third-party services (email, SMS providers)
  - Network infrastructure beyond application layer
  - Denial of service attacks

### Test Accounts

- **Admin Account**: `admin@clsu.edu.ph` / `admin123`
- **Faculty Account**: `faculty@clsu.edu.ph` / `faculty123`
- **Test Student Accounts**: Pre-created for testing

## Testing Tools

### Web Application Scanners

- OWASP ZAP
- Burp Suite Professional
- Nikto
- Dirbuster/Gobuster

### Authentication Testing

- Hydra (for controlled brute force)
- Patator
- Custom scripts for MFA testing

### API Testing

- Postman with security scripts
- RESTler
- Fuzzing tools (ffuf, wfuzz)

### Database Testing

- sqlmap (read-only mode)
- NoSQL injection testing tools

## Specific Test Cases

### Authentication & Authorization

#### Login Security

```bash
# Test brute force protection
# Should be blocked after 5 attempts
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clsu.edu.ph","password":"wrong"}' \
  --repeat 10
```

#### Session Management

- Test session fixation
- Test session hijacking
- Test concurrent session handling
- Test session timeout

#### Password Reset

- Test token leakage in logs
- Test token expiration
- Test token reuse prevention
- Test email enumeration prevention

### API Security

#### Endpoint Enumeration

```bash
# Test for hidden endpoints
gobuster dir -u http://localhost:3000/api/ \
  -w /usr/share/wordlists/dirb/common.txt \
  -t 10
```

#### Parameter Tampering

- Test IDOR (Insecure Direct Object References)
- Test mass assignment vulnerabilities
- Test parameter pollution

#### Rate Limiting

```bash
# Test rate limiting bypass
# Should be blocked after configured limits
ab -n 1000 -c 10 http://localhost:3000/api/auth/login
```

### Data Security

#### SQL Injection

```sql
-- Test for SQL injection in login
' OR '1'='1' -- -
' UNION SELECT * FROM users -- -
```

#### XSS Testing

```javascript
// Test for reflected XSS
<script>alert('XSS')</script>
// Test for stored XSS in user profiles
<img src=x onerror=alert('XSS')>
```

#### File Upload Security

- Test file type restrictions
- Test file size limits
- Test directory traversal
- Test malicious file uploads

## Reporting Requirements

### Vulnerability Classification

- **Critical**: Remote code execution, authentication bypass
- **High**: SQL injection, privilege escalation
- **Medium**: XSS, CSRF, information disclosure
- **Low**: Best practice violations, minor information leaks
- **Info**: Informational findings

### Report Structure

1. **Executive Summary**

   - Overall risk assessment
   - Critical findings summary
   - Recommendations priority

2. **Methodology**

   - Tools used
   - Test scope
   - Limitations

3. **Findings**

   - Vulnerability details
   - Proof of concept
   - Impact assessment
   - Remediation recommendations

4. **Risk Assessment**

   - CVSS scoring
   - Business impact
   - Likelihood of exploitation

5. **Remediation Plan**
   - Prioritized fixes
   - Implementation timeline
   - Verification steps

## Compliance Considerations

### ISO 27001 Alignment

- **A.9 Access Control**: Authentication and authorization testing
- **A.12 Operations Security**: Logging and monitoring verification
- **A.14 System Acquisition**: Secure development verification

### OWASP Alignment

- **A01:2021-Broken Access Control**
- **A02:2021-Cryptographic Failures**
- **A03:2021-Injection**
- **A05:2021-Security Misconfiguration**
- **A07:2021-Identification and Authentication Failures**

## Testing Schedule

### Development Phase

- Automated security testing in CI/CD
- Static Application Security Testing (SAST)
- Dependency vulnerability scanning

### Pre-Production

- Full penetration testing
- Third-party security assessment
- Compliance verification

### Production

- Continuous security monitoring
- Regular vulnerability assessments
- Incident response testing

## Rules of Engagement

### Legal Compliance

- All testing must be authorized
- Stay within defined scope
- No production data manipulation
- Respect rate limiting and DoS protections

### Ethical Considerations

- Minimize impact on production systems
- Report findings promptly
- Provide clear remediation guidance
- Maintain confidentiality

### Communication

- Daily status updates during testing
- Immediate notification of critical findings
- Weekly progress reports
- Final report within 5 business days

## Emergency Procedures

### Critical Finding Discovery

1. Immediately stop exploitation
2. Notify security team lead
3. Document finding details
4. Assist with emergency remediation

### System Instability

1. Stop all testing activities
2. Notify development team
3. Document incident details
4. Wait for system restoration

## Tools and Scripts

### Custom Testing Scripts

```bash
# Authentication testing script
#!/bin/bash
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpass"}' \
    -w "%{http_code}\n" \
    -o /dev/null
done
```

### Automated Testing

- Integrate with CI/CD pipelines
- OWASP ZAP automated scans
- Custom security test suites

## Post-Testing Activities

### Remediation Verification

- Re-test fixed vulnerabilities
- Validate security controls
- Performance impact assessment

### Lessons Learned

- Update testing methodology
- Improve security controls
- Enhance monitoring capabilities

### Continuous Improvement

- Regular security training
- Tool and technique updates
- Process optimization

This comprehensive testing framework ensures thorough security assessment while maintaining system stability and compliance requirements.
