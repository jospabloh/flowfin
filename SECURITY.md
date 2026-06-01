# Security Policy

**Version**: 1.0  
**Last Updated**: June 1, 2026  
**Status**: ACTIVE

---

## Responsible Disclosure

FlowFin values responsible disclosure of security vulnerabilities. If you discover a security vulnerability in FlowFin, please report it responsibly following this policy.

### How to Report a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities. Instead:

1. **Email**: security@flowfin.app
   - Subject line: "SECURITY: [Vulnerability Title]"
   - Include:
     - Vulnerability description
     - Affected component/version
     - Steps to reproduce
     - Potential impact
     - Suggested fix (optional)

2. **Provide Details**:
   ```
   Title: [Clear, concise title]
   Severity: [Critical/High/Medium/Low]
   Affected Version: [0.1.0 or earlier]
   Description: [Detailed description]
   Steps to Reproduce: [Step-by-step instructions]
   Proof of Concept: [Code/screenshots showing the issue]
   Impact: [What could an attacker do]
   Suggested Fix: [Optional]
   ```

3. **Encryption** (Optional but recommended):
   - If you'd like to encrypt your report, use our GPG key:
   - [Available at security.flowfin.app/pgp]

### Our Commitment

- We will acknowledge receipt within **24 hours**
- We will provide status updates every **3-5 days**
- We will NOT publicly disclose until we've had time to patch (typically 30-90 days)
- We will credit you in our security bulletin (if you agree)
- We will work with you to ensure the fix is comprehensive

### Coordinated Disclosure Timeline

1. **Day 1**: You report vulnerability
2. **Day 1**: We acknowledge receipt
3. **Days 2-7**: We investigate and develop fix
4. **Days 8-14**: We test fix and prepare patch
5. **Day 15-30**: We release patch
6. **Day 31**: We publicly disclose (if not already disclosed elsewhere)

If you find the timeline is not working for you, please communicate this when reporting.

---

## Security Audit Information

### Current Audit Status

- **Last Audit**: June 1, 2026
- **Audit Type**: Full codebase review (code + dependencies + CI/CD)
- **Status**: Critical issues identified, work in progress
- **Report**: See [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)

### Audit Schedule

- **Quarterly**: Automated dependency scanning + manual review
- **Semi-annually**: Professional penetration test (planned for v1.0.0)
- **Post-incident**: Additional reviews as needed

### Current Known Issues

See [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) for:
- Critical issues requiring immediate attention
- High/medium severity issues
- Recommendations for remediation
- Timeline for fixes

---

## Vulnerability Management

### Dependency Management

We use several tools to manage vulnerabilities:

1. **npm audit**
   - Automatic scanning of dependencies
   - Integrated into CI/CD pipeline
   - Manual review of findings

2. **Dependabot**
   - Automated dependency updates
   - Scheduled security patches
   - Integration with GitHub

3. **SAST Tools** (Planned)
   - Static application security testing
   - Code analysis for common vulnerabilities

### Vulnerability Response

**CRITICAL Vulnerabilities**:
- Patch within 24 hours (hotfix release)
- Force update recommended
- Public security advisory issued immediately

**HIGH Vulnerabilities**:
- Patch within 3-7 days (patch release)
- Recommend update in security advisory
- Tracked in CHANGELOG.md

**MEDIUM Vulnerabilities**:
- Patch within 1-2 weeks (minor release)
- Mentioned in release notes
- Fixed in next regular release

**LOW Vulnerabilities**:
- Patch in next regular release
- No special advisory needed
- Tracked in changelog

---

## Security Best Practices for Users

### Protect Your Account

1. **Strong Passwords**
   - Use at least 16 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Never reuse passwords
   - Use a password manager

2. **Two-Factor Authentication**
   - Enable 2FA in Account Settings
   - Use authenticator app (recommended) or SMS
   - Save backup codes in safe location

3. **Secure Devices**
   - Keep OS and browser updated
   - Use antivirus/antimalware
   - Enable device encryption
   - Don't use public WiFi for sensitive operations

4. **Careful with Sharing**
   - Don't share your password
   - Review family member invitations
   - Revoke access when needed
   - Verify account activity regularly

### Report Suspicious Activity

If you notice suspicious activity in your account:

1. Change your password immediately
2. Review account activity log
3. Check for unauthorized transactions
4. Contact support: support@flowfin.app
5. Follow instructions for account recovery

---

## Security Standards & Compliance

### Current Status

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 | In Progress | Addressing identified issues |
| CWE Top 25 | In Progress | Code review addressing items |
| GDPR Ready | Planned for v1.0.0 | Data handling review needed |
| PCI-DSS | Planned for v1.0.0 | If handling card data |
| SOC 2 | Planned for v2.0.0 | Post-production readiness |

### Security Testing

- **Automated Testing**: GitHub Actions (lint, test, audit)
- **Manual Code Review**: All PRs reviewed for security
- **Penetration Testing**: Professional test planned for v1.0.0
- **Bug Bounty**: Program details coming soon

---

## Development Security

### Secure Coding Guidelines

All developers must follow:

1. **OWASP Top 10 Awareness**
2. **Input Validation**
   - Validate all user input
   - Use whitelisting approach
   - Sanitize before storage/display

3. **Authentication & Authorization**
   - Use Base44 SDK auth
   - Implement role-based access control
   - Never trust client-side checks alone

4. **Data Protection**
   - Encrypt sensitive data at rest
   - Use TLS for all data in transit
   - Never log sensitive information

5. **Dependency Management**
   - Keep dependencies updated
   - Review security advisories
   - Use approved packages only

6. **Error Handling**
   - Don't expose sensitive errors
   - Log security events
   - Implement proper exception handling

### Code Review Checklist

Before merging any PR, reviewers must verify:

- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] No unsafe deserialization
- [ ] No XSS vulnerabilities
- [ ] No SQL injection vectors
- [ ] CORS properly configured
- [ ] Authentication required where needed
- [ ] No unencrypted sensitive data
- [ ] Error messages are sanitized
- [ ] Dependencies are up-to-date

### Secrets Management

- **Never** commit secrets to git
- Use environment variables
- Rotate secrets regularly
- Use .gitignore to exclude .env files
- Use GitHub Secrets for CI/CD

---

## Incident Response

### Incident Classification

**CRITICAL**: 
- Complete system compromise
- Data breach affecting users
- Widespread outage

**HIGH**:
- Significant security vulnerability
- Data exposure
- Service degradation

**MEDIUM**:
- Non-critical security issue
- Limited user impact
- Partial service degradation

**LOW**:
- Minor issue
- No user impact
- Documentation needed

### Response Procedure

1. **Detect**: Security issue identified
2. **Assess**: Determine severity and scope
3. **Contain**: Stop attack/limit damage
4. **Investigate**: Understand what happened
5. **Remediate**: Fix the issue
6. **Verify**: Confirm fix works
7. **Disclose**: Communicate to users
8. **Learn**: Improve for future

### User Communication

In case of security incident:
- Notify affected users within 24 hours
- Provide clear remediation steps
- Explain what happened and impact
- Share what we're doing to prevent recurrence
- Offer support resources

---

## Third-Party Security

### Dependency Vetting

We use only well-maintained, trusted packages:
- Active community
- Security track record
- Regular updates
- Clear maintenance plan
- License compatibility

### Vendor Security

For services we integrate with (Base44, PostHog, Stripe):
- Review security documentation
- Verify compliance certifications
- Monitor security advisories
- Regular review of permissions

---

## Security Roadmap

### v0.1.0 (Current)
- ✅ Comprehensive security audit
- ✅ Critical vulnerability patches
- ✅ Security documentation

### v0.2.0 (July 2026)
- Expand test coverage to 80%+
- Implement SAST in CI/CD
- Professional penetration test preparation
- CSP headers implementation

### v0.5.0 (Q4 2026)
- GDPR compliance audit
- PCI-DSS assessment (if needed)
- Security incident response procedures
- Automated security scanning

### v1.0.0 (Q1 2027)
- Professional penetration test
- SOC 2 readiness
- Bug bounty program launch
- Production security certification

---

## Contact

- **Security Email**: security@flowfin.app
- **General Support**: support@flowfin.app
- **Documentation**: https://docs.flowfin.app/security
- **Status Page**: https://status.flowfin.app

---

## Acknowledgments

We appreciate the work of security researchers and community members who help improve FlowFin's security. Please see [ACKNOWLEDGMENTS.md](./ACKNOWLEDGMENTS.md) for a list of security contributors.

---

**Last Updated**: June 1, 2026  
**Next Review**: June 15, 2026

For questions about this policy, contact security@flowfin.app
