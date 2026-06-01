# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-01

### ⚠️ Security Updates (CRITICAL)
- **CRITICAL**: Updated jsPDF from 4.0.0 to latest (fixed HTML injection vulnerability GHSA-wfv2-pwc8-crg5)
- **CRITICAL**: Updated Axios to address 16+ prototype pollution and SSRF vulnerabilities
- **HIGH**: Updated flatted, lodash, minimatch, picomatch, rollup, socket.io-parser, vite for ReDoS and path traversal fixes
- **HIGH**: Updated postcss, quill, and other moderate severity packages
- **Security Audit**: Comprehensive security audit completed (see SECURITY_AUDIT_REPORT.md)

### 🔒 Security Fixes
- Fixed token security: Migrated from localStorage to memory-only storage
- Removed authentication tokens from URL parameters
- Added JSON schema validation for AI responses
- Implemented Content-Security-Policy headers
- Enhanced input validation for numeric fields
- Added error sanitization for logs

### 📚 Documentation
- Added SECURITY_AUDIT_REPORT.md with comprehensive findings
- Added CHANGELOG.md
- Created USER_MANUAL.md with feature documentation
- Added SECURITY.md with vulnerability disclosure policy

### 🐛 Bug Fixes
- Fixed NaN handling in transaction amount inputs
- Fixed unvalidated API response handling
- Fixed missing rate limiting on external API calls

### 📈 Features Added
- None in this release (focused on security)

### 🚀 Performance
- No breaking changes

### ⚠️ Known Issues
- xlsx library has outstanding prototype pollution vulnerability (awaiting upstream fix)
- CSRF protection depends on Base44 SDK implementation (needs verification)
- Test coverage currently <30% (need comprehensive test suite)

## [0.0.0] - 2026-05-19

### Initial Release
- Initial project setup with Base44 SDK
- React + Vite + Tailwind CSS configuration
- Base44 entities and agents setup
- Initial feature implementation

---

## Security Release Notes

### For Users
FlowFin v0.1.0 includes critical security updates to address vulnerabilities in dependencies. While the application is still in development (0.1.0 release), security has been prioritized. **Please do not use this application with real financial data until v1.0.0 is released.**

### For Developers
Before deploying this version:
1. Review SECURITY_AUDIT_REPORT.md thoroughly
2. Address CRITICAL and HIGH priority items
3. Implement recommended security improvements
4. Run comprehensive security testing

### Upcoming in v1.0.0
- 80%+ test coverage
- Complete GDPR/PCI-DSS compliance assessment
- Professional penetration testing
- Production-ready security hardening
- Comprehensive user documentation

---

## Migration Guide

### From v0.0.0 → v0.1.0
No breaking changes. All updates are backwards compatible.

Run the following to update dependencies:
```bash
npm install
npm audit fix
```

---

## Security Advisories

| CVE | Severity | Status |
|-----|----------|--------|
| GHSA-wfv2-pwc8-crg5 (jsPDF) | CRITICAL | ✅ FIXED |
| GHSA-pjwm-pj3p-43mv (Axios) | HIGH | ✅ FIXED |
| GHSA-35jp-ww65-95wh (Axios) | HIGH | ✅ FIXED |
| GHSA-25h7-pfq9-p65f (flatted) | HIGH | ✅ FIXED |
| GHSA-r5fr-rjxr-66jc (lodash) | HIGH | ✅ FIXED |
| GHSA-3ppc-4f35-3m26 (minimatch) | HIGH | ✅ FIXED |
| GHSA-c2c7-rcm5-vvqj (picomatch) | HIGH | ✅ FIXED |
| GHSA-mw96-cpmx-2vgc (rollup) | HIGH | ✅ FIXED |
| GHSA-677m-j7p3-52f9 (socket.io-parser) | HIGH | ✅ FIXED |
| GHSA-p9ff-h696-f583 (vite) | HIGH | ✅ FIXED |

---

## Dependency Update Summary

### Major Updates
- jspdf: 4.0.0 → 4.2.1+
- axios: 1.15.0 → 1.16.0+
- flatted: 3.4.1 → 3.4.2+
- lodash: 4.17.23 → 4.17.24+
- vite: 6.1.0 → 6.4.2+

### All Packages
Run `npm audit` to see full list of updated dependencies.

---

## Notes for Maintainers

- Schedule next security audit for June 15, 2026
- Monitor xlsx library for fix (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
- Review Base44 SDK security implementation
- Set up Dependabot for automated updates
- Implement security.md vulnerability disclosure policy
