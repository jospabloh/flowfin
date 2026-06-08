# FlowFin User Manual

**Version**: 0.5.0
**Last Updated**: June 8, 2026
**Status**: BETA (Development Stage)

---

## ⚠️ Important Notice

FlowFin is currently in **BETA development stage (v0.5.0)**. This version includes security updates and permission hardening. For the latest security information, see [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md).

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Features](#core-features)
3. [Using the Dashboard](#using-the-dashboard)
4. [Transaction Management](#transaction-management)
5. [AI Assistant (Finia)](#ai-assistant-finia)
6. [Family Features](#family-features)
7. [Advanced Features](#advanced-features)
8. [New Features (v0.2.0)](#new-features-v020)
9. [Troubleshooting](#troubleshooting)
10. [Latest Updates (v0.5.0)](#latest-updates-v050-release-notes)
11. [Previous Releases](#previous-releases)

---

## Getting Started

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jospabloh/flowfin.git
   cd flowfin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_BASE44_APP_ID=your_app_id
   VITE_BASE44_APP_BASE_URL=your_backend_url
   VITE_POSTHOG_KEY=your_posthog_key
   ```
   
   Contact the development team for these credentials.

4. **Run development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5173`

5. **Build for production**
   ```bash
   npm run build
   ```

---

## Core Features

### 1. Dashboard
The Dashboard provides an at-a-glance overview of your financial status.

**Features**:
- Account balance summary
- Recent transactions
- Budget progress
- Financial goals tracking
- Quick action buttons

**Access**: Main menu → Dashboard

### 2. Transaction Management
Comprehensive transaction tracking and management system.

**Features**:
- Create, edit, delete transactions
- Categorize transactions
- Tag transactions
- Receipt capture (with image upload)
- Transaction search and filtering
- Bulk transaction operations
- Transaction history and audit trail

**Access**: Main menu → Transactions

**Transaction Types Supported**:
- Expense
- Income
- Transfer (between accounts)
- Scheduled Payment
- Rental Payment
- Investment Payment
- MSI (Installment) Payment

### 3. Budget Management
Set and track budgets across categories.

**Features**:
- Category-based budgeting
- Budget alerts when nearing limit
- Budget vs. actual spending comparison
- Adjustable budget periods (monthly, quarterly, yearly)
- Budget recommendations

**Access**: Main menu → Budget

### 4. Financial Goals
Set and monitor financial goals.

**Features**:
- Create savings goals
- Set target amounts and deadlines
- Track progress
- Goal recommendations
- Milestone celebrations

**Access**: Main menu → Goals

### 5. Investment Tracking
Monitor and track investments.

**Features**:
- Add investments (stocks, crypto, real estate, etc.)
- Record investment payments
- Track returns and performance
- View investment history

**Access**: Main menu → Investments

### 6. Payment Methods
Manage multiple payment methods.

**Features**:
- Add credit/debit cards
- Bank account management
- Digital wallet integration
- Payment method prioritization
- Fraud detection alerts

**Access**: Account Settings → Payment Methods

---

## Using the Dashboard

### Overview Section
The dashboard main view shows:
- **Total Balance**: Sum of all accounts
- **Monthly Spending**: YTD spending trend
- **Budget Status**: Top budgets and their progress
- **Recent Transactions**: Last 10 transactions

### Quick Actions
- ➕ Add Transaction
- 📈 View Reports
- 🎯 Add Goal
- 💳 Add Payment Method

### Navigation
- **Left Sidebar**: Main menu navigation
- **Top Bar**: User profile, notifications, search
- **Mobile**: Hamburger menu (swipe to open)

---

## Transaction Management

### Adding a Transaction

1. Click **"+ Add Transaction"** or go to Transactions → New
2. Select transaction type:
   - Expense
   - Income
   - Transfer
   - Scheduled Payment
   - Rental Payment
   - Investment Payment
   - MSI Payment

3. Fill in transaction details:
   - **Date**: When the transaction occurred
   - **Amount**: Transaction amount
   - **Category**: Select or create category
   - **Subcategory**: Optional detailed category
   - **Account/Payment Method**: Where transaction occurred
   - **Description**: Optional notes
   - **Tags**: For custom filtering

4. (Optional) **Attach Receipt**
   - Click camera icon to capture receipt
   - Or upload existing receipt image
   - AI will extract transaction details

5. Click **"Save"** to create transaction

### Editing a Transaction

1. Go to Transactions
2. Click on the transaction to edit
3. Modify desired fields
4. Click **"Save Changes"**

### Deleting a Transaction

1. Go to Transactions
2. Swipe left (mobile) or right-click (desktop) on transaction
3. Select **"Delete"**
4. Confirm deletion

### Transaction Filters
- By date range
- By category
- By amount range
- By status (pending, confirmed, cancelled)
- By tags
- By payment method

### Bulk Operations
- Select multiple transactions (checkbox)
- **Recategorize**: Change category for multiple transactions
- **Delete**: Remove multiple transactions
- **Export**: Export to CSV/Excel
- **Print**: Print transaction list

---

## AI Assistant (Finia)

Finia is FlowFin's intelligent financial assistant powered by AI.

### Accessing Finia

- **Chat Icon**: Bottom right of any page
- **Voice Activation**: Say "Hey Finia" (if enabled)
- **Quick Chips**: Suggested actions based on context

### Finia Capabilities

#### 📊 Financial Analysis
- "What did I spend on groceries last month?"
- "Show me my spending trends for the last 3 months"
- "Which categories did I overspend in?"
- "What's my average daily spending?"

#### 💡 Recommendations
- "Should I adjust my budget?"
- "Can you suggest a savings goal?"
- "What are my best investment opportunities?"
- "How can I save more money?"

#### 📝 Quick Transactions
- "Add a $50 coffee expense"
- "Record my $2000 salary"
- "Log my investment of 100 shares"

#### 🤖 Smart Features
- **Receipt Analysis**: Upload receipt → automatic categorization
- **Spending Patterns**: AI identifies unusual spending
- **Fraud Detection**: Alerts on suspicious transactions
- **Goal Tracking**: Suggests ways to reach goals faster

### Voice Commands (if enabled)
- "How much did I spend today?"
- "What's my budget status?"
- "Show me my investments"
- "Set a savings goal of $10,000"

### Privacy & Data
- All Finia interactions are encrypted
- Data is used only for analysis and recommendations
- You can delete chat history anytime
- No data is sold to third parties

---

## Family Features

### Setting Up Family
1. Go to Family Settings (requires family admin role)
2. Click **"Invite Family Members"**
3. Enter email addresses of family members
4. Set roles for each member:
   - **Admin**: Full access, can invite/remove members
   - **Editor**: Can create/edit transactions and budgets
   - **Viewer**: Read-only access

### Family Dashboard
- View all family transactions
- See combined budgets
- Track shared goals
- Monitor total family net worth

### Roles & Permissions

FlowFin uses two family-level roles: **Admin** and **Member**. A platform-level Admin role also exists for system management (Waitlist Admin).

**Default permissions by role** (admin can customize all of these via the Permission Admin panel):

| Feature / Action | Admin | Member (Default) |
|-----------------|-------|-----------------|
| **Dashboard** | | |
| View dashboard & summaries | ✅ | ✅ |
| **Transactions** | | |
| View transactions | ✅ | ✅ |
| Create transactions | ✅ | ✅ |
| Edit transactions | ✅ | ✅ |
| Delete transactions | ✅ | ✅ |
| Export to Excel | ✅ | ✅ |
| **Budget** | | |
| View budgets | ✅ | ✅ (read-only) |
| **Scheduled Payments** | | |
| View scheduled payments | ✅ | ✅ |
| Create/mark/manage payments | ✅ | ❌ |
| **Reports** | | |
| View all report types | ✅ | ✅ |
| Export PDF/Image | ✅ | ✅ |
| Share reports | ✅ | ❌ |
| **AI Assistant (Finia)** | | |
| Chat, voice, receipt scan | ✅ | ✅ |
| Clear conversation | ✅ | ✅ |
| **Goals** | | |
| View goals | ✅ | ✅ |
| Create / Edit / Delete goals | ✅ | ❌ |
| **Messages** | | |
| View inbox & threads | ✅ | ✅ |
| Send / Delete messages | ✅ | ❌ |
| **Savings Dashboard** | | |
| View savings opportunities | ✅ | ❌ |
| **Trips** | | |
| View trips & expenses | ✅ | ✅ |
| Create / Manage / Close trips | ✅ | ❌ |
| **Investments** | | |
| View investments & details | ✅ | ✅ |
| Create / Edit / Delete investments | ✅ | ❌ |
| Record / View payment history | ✅ | ❌ |
| **Rentals** | | |
| View properties & details | ✅ | ✅ |
| Create / Edit / Delete properties | ✅ | ❌ |
| Record / Reverse rental payments | ✅ | ❌ |
| **MSI (Installments)** | | |
| View MSI list & tracking | ✅ | ✅ |
| Create / Edit / Delete MSI | ✅ | ❌ |
| Record MSI payments | ✅ | ❌ |
| **Catalogs** | | |
| View categories, persons, methods | ✅ | ✅ |
| Create / Edit / Delete catalogs | ✅ | ❌ |
| **Family Admin** | | |
| View / Invite / Remove members | ✅ | ❌ |
| Manage billing & plan | ✅ | ❌ |
| **Permission Admin** | | |
| View & edit permission matrix | ✅ | ❌ |

> **Note**: All member defaults marked ❌ can be unlocked by an Admin via Settings → Permissions.

### Family Rules
- Set rules for transaction categorization
- Create spending limits by member
- Approve transactions above threshold
- Generate family spending reports

### Family Notifications
- Receive alerts when family member adds large transactions
- Budget threshold notifications
- Goal milestone celebrations

---

---

## New Features (v0.2.0)

### 7. Financial Goals
Track personal and family savings goals with progress visualization.

**Features**:
- Create savings goals with a target amount and deadline
- View a goal card with progress percentage and remaining balance
- Edit or delete goals at any time
- Share goal progress cards (admin permission required)
- Goal data derived automatically from linked transactions

**Access**: Main menu → Metas (Goals)

**Permissions**:
- Members: can **view** goal list and individual goal details by default
- To create, edit, or delete goals: admin must grant `goals.manage` permission

---

### 8. Family Messages
Send categorized financial notes between family members.

**Features**:
- Compose messages with categories: General, Payment, Income, Movement
- View incoming and sent message threads
- Message subject and body with timestamp
- Select recipient from family member list
- Filter threads by category

**Access**: Main menu → Mensajes (Messages)

**Permissions**:
- Members: can **view** inbox and threads by default
- To send or delete messages: admin must grant `messages.manage` permission

---

### 9. Savings Dashboard
AI-powered savings opportunity analysis based on the last 6 months of transactions.

**Features**:
- **Estimated monthly savings**: total identified savings potential
- **Forgotten subscriptions**: recurring charges that may no longer be needed
- **Non-essential opportunities**: discretionary spending areas to consider reducing
- **Refresh**: re-run the analysis against latest transactions
- All amounts shown in your family's configured currency

**Access**: Main menu → Ahorros (Savings)

**Permissions**:
- Members: no access by default
- Admin must explicitly grant `savings.view` permission to allow member access

---

### 10. Trips
Track travel expenses grouped by destination.

**Features**:
- Create a trip with name, destination, and travel dates
- Associate transactions to a trip via `trip_id`
- View active trips with cumulative expenses
- View trip history (closed trips)
- Spending breakdown by category within a trip

**Access**: Main menu → Viajes (Trips)

**Permissions**:
- Members: can **view** trip list, details, and expenses by default
- To create, edit, close, or delete trips: admin must grant `trips.manage` permission
- Note: Trips access is also subject to the billing feature gate for your plan

---

### 11. Waitlist Admin *(Platform Administrators Only)*
Manage the FlowFin user waitlist.

**Features**:
- View all waitlist entries with status (pending, invited, joined)
- Search and filter by name, email, or status
- Invite individual users from the waitlist
- Bulk-invite multiple pending users at once
- Track invite totals: total, pending, invited, joined
- Export waitlist data

**Access**: Admin panel → Waitlist Admin
**Requirement**: Platform-level admin account (`role === 'admin'`). This page is hidden from all family-level admin and member accounts.

---

## Advanced Features

### 1. Scheduled Payments
Set up recurring payments.

**Features**:
- Create recurring transactions
- Flexible schedules (daily, weekly, monthly, yearly)
- Auto-post payments on schedule
- Override or skip individual occurrences

**Access**: Transactions → Schedule

### 2. Investment Management
Detailed investment tracking.

**Features**:
- Add multiple investment types
- Track cost basis and current value
- Calculate returns
- Portfolio diversification analysis

**Access**: Main menu → Investments

### 3. Rental Property Tracking
Manage rental property finances.

**Features**:
- Track rental income
- Record property expenses
- Calculate ROI
- Generate rental reports

**Access**: Main menu → Rental Properties

### 4. MSI (Installment) Payments
Track monthly installment payments.

**Features**:
- Record MSI purchases
- Track payment schedule
- Calculate remaining balance
- View payment history

**Access**: Main menu → MSI Payments

### 5. Reports & Analytics
Comprehensive financial reporting.

**Features**:
- Spending trends
- Income vs. expenses
- Category breakdowns
- Time-based comparisons
- Custom report generation
- Export to PDF/Excel

**Access**: Main menu → Reports

### 6. Receipt Capture & OCR
AI-powered receipt analysis.

**Features**:
- Photograph receipt
- Automatic extraction of:
  - Merchant name
  - Amount
  - Date
  - Items purchased
- Auto-categorization
- Duplicate detection

**Access**: Transactions → "+" → Capture Receipt

### 7. Data Export
Export your financial data.

**Supported Formats**:
- CSV
- Excel
- PDF
- JSON

**Access**: Settings → Data Export

---

## Troubleshooting

### Common Issues

#### "Service Worker Registration Failed"
**Solution**: This is usually not critical. The app will work normally. Check browser console for details.

#### Transactions Not Saving
**Solution**:
1. Check internet connection
2. Clear browser cache
3. Try incognito/private mode
4. Check browser developer tools for errors

#### "Unauthorized" Error
**Solution**:
1. Log out completely
2. Log back in
3. Check if your account is active
4. Contact support if issue persists

#### Receipt Capture Not Working
**Solution**:
1. Allow camera permissions
2. Ensure good lighting
3. Position receipt flat on surface
4. Try newer browser version

#### Slow Performance
**Solution**:
1. Clear browser cache
2. Close unused tabs
3. Check internet speed
4. Try different browser

### Contacting Support
- **Email**: support@flowfin.app
- **In-App**: Settings → Help → Contact Support
- **Documentation**: https://docs.flowfin.app

---

## Latest Updates (v0.5.0 Release Notes)

### New in v0.5.0 (June 8, 2026)

#### 🔒 Security Fixes

**Permission Enforcement**
- **MEDIUM → FIXED**: The Savings Dashboard page was accessible to any authenticated family member regardless of their `savings.view` permission. Members now receive a redirect to the Dashboard if they do not have view access (the default for new members). No data was exposed to unauthorized users since the backend enforces family membership, but the page-level gate was missing and is now in place.
- **MEDIUM → FIXED**: The permissions system now uses a deny-by-default approach when a partial permission record exists in the database. Previously, null fields in a `RolePermission` record would default to `true`, potentially granting unintended access. All fields now default to `false` when not explicitly set.

**RLS Hardening**
- Platform admin accounts can now access and manage all family data for support purposes. This does not change what family admins and members can do — their access is unchanged.
- Conversation sessions are now strictly per-user. AI conversation history is only visible to the user who created it, not to all family members.

**Dependency Update**
- **MODERATE → FIXED**: `react-router` updated to resolve a same-origin open-redirect vulnerability (protocol-relative URL).

#### ⚠️ Known Open Issues in v0.5.0
- **HIGH**: xlsx prototype pollution/ReDoS — no upstream fix available; the app only writes xlsx files (never parses user-uploaded files), so this is low immediate risk.
- **INFO**: WaitlistAdmin platform tool — only visible to platform admins; no action required for family admins or members.

#### What's Next
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations
- SAST (static analysis security testing) integration

---

## Previous Releases

### v0.4.0 (June 1, 2026)

#### 🔒 Security / Code Quality
- **LOW → FIXED**: Removed unused import in the AI assistant message bubble component — resolved a lint failure.
- Version synchronized: package.json and CHANGELOG now reflect all deployed changes through v0.4.0.

---

### v0.3.0 (June 1, 2026)

#### 🔒 Security Fixes
- **CRITICAL → RESOLVED**: jsPDF updated, eliminating HTML injection vulnerability (GHSA-wfv2-pwc8-crg5, CVSS 9.6)
- **HIGH × 8 → RESOLVED**: `npm audit fix` applied — axios, flatted, lodash, minimatch, picomatch, rollup, socket.io-parser, vite updated
- **NEW**: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy response headers deployed
- **NEW**: CI security gate blocks merges on critical dependency vulnerabilities

#### 🆕 Feature Gate Improvements
- Goals, Messages, and Trips pages now include action-level permission gates using `usePermission`

---

### v0.2.0 (June 1, 2026)

#### 🔒 Security Fixes (All Tenants — Action May Be Required)
- **CRITICAL PERMISSION FIX**: The `member` role previously had full admin-level permissions on Catalogs, Investments, Rentals, and MSI modules, allowing members to create, edit, and delete financial records that should be admin-controlled. **This is now corrected — members default to view-only for these modules.**
- **Permission Reset Notice**: If any family has existing custom permission overrides granting members access to these modules, those overrides remain intact. The fix only affects the factory defaults applied to new families or when permissions are reset.
- Budget view section permission corrected — members' `budget.view` no longer erroneously carries write/modify/delete flags.
- Five new permission manifests added for Goals, Messages, Savings Dashboard, Trips, and Waitlist Admin.
- Permission snapshot regenerated (187 permission entries).

#### 🆕 New Features
- **Goals** page: Create and track financial savings goals with progress visualization
- **Messages** page: Send categorized financial notes between family members
- **Savings Dashboard**: AI-powered analysis identifying forgotten subscriptions and savings opportunities
- **Trips** page: Track expenses grouped by travel destination
- **Waitlist Admin**: Platform admin tool for managing user waitlist (admin-only)
- **Release Notes** page: In-app version history

#### 🐛 Bug Fixes
- Deno linter errors resolved in backend functions

---

### Previous Release (v0.1.0)

### New in v0.1.0 (June 1, 2026)

#### 📚 Documentation
- Security Audit Report published (19 dependency vulnerabilities identified)
- CHANGELOG, USER_MANUAL, and SECURITY.md created
- Version updated from 0.0.0 to 0.1.0; package renamed from `base44-app` to `flowfin`

#### 📊 Feature Enhancements
- Transaction Calculator Widget
- Scheduled Payment Conversion
- Enhanced AI Assistant (Finia) with predictive chips
- Refreshed transaction entry modal

#### ⚠️ Known Issues (carry-forward to v0.2.0)
- All 19 npm dependency vulnerabilities remain open
- Token storage in localStorage unaddressed

---

## Security & Privacy

### Data Protection
- All data encrypted in transit (HTTPS/TLS)
- Secure authentication with Base44 SDK
- Role-based access control
- Regular security audits

### What We Collect
- Transactions and financial data
- User preferences
- Analytics (anonymous)
- Device information for debugging

### What We DON'T Collect
- Credit card numbers (payment processing only)
- Social security numbers
- Full bank account numbers
- Personal identification documents

### Privacy Policy
For complete privacy details, see [Privacy Policy](./PRIVACY.md)

### Report Security Issues
See [SECURITY.md](./SECURITY.md) for responsible disclosure guidelines.

---

## Frequently Asked Questions

**Q: Is FlowFin safe for my financial data?**
A: FlowFin is in BETA development. While we've conducted security audits, we recommend not using it with real critical financial data until v1.0.0. See SECURITY_AUDIT_REPORT.md for details.

**Q: Can I export my data?**
A: Yes! Go to Settings → Data Export and download in CSV, Excel, PDF, or JSON format.

**Q: Is there an offline mode?**
A: Partial offline support is available. Recently synced data is cached locally. Full offline mode coming in v0.2.0.

**Q: How do I delete my account?**
A: Go to Account Settings → Danger Zone → Delete Account. This will permanently remove all your data.

**Q: Can I use FlowFin on mobile?**
A: Web app works on mobile browsers. Native apps coming in v0.2.0.

**Q: What payment methods do you accept?**
A: We don't charge for FlowFin at this time (BETA). Future pricing TBD.

**Q: How do I report a bug?**
A: Use Settings → Help → Report Bug or email support@flowfin.app

**Q: Is my family data shared securely?**
A: Yes. Family members can only see data you've authorized. Use role-based permissions to control access.

---

## Additional Resources

- **Blog**: https://flowfin.app/blog
- **Documentation**: https://docs.flowfin.app
- **GitHub**: https://github.com/jospabloh/flowfin
- **Status**: https://status.flowfin.app
- **Community**: https://community.flowfin.app

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.2.0 | 2026-06-01 | Added Goals, Messages, Savings Dashboard, Trips, Waitlist Admin; updated permissions table; added v0.2.0 release notes |
| 0.1.0 | 2026-06-01 | Initial user manual with security audit findings |

---

**Last Updated**: June 1, 2026
**Next Update**: June 15, 2026 (v0.3.0 patch release)

For the latest updates, visit [CHANGELOG.md](./CHANGELOG.md)
