# FlowFin User Manual

**Version**: 2.20.0
**Last Updated**: July 6, 2026
**Status**: BETA (Development Stage)

---

## ⚠️ Important Notice

FlowFin is currently in **BETA development stage (v2.20.0)**. This release fixes a permissions gap where the Viajes and Metas modules ignored admin-configured permissions, adds active session tracking with remote force-logout, and includes RLS security hardening for Trips and Support Ticket Messages. For the latest security information, see [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md).

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
10. [Latest Updates (v2.20.0)](#latest-updates-v2200-release-notes)
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

### Shared / Split Expenses ("Gasto Compartido")

Use this when one purchase was actually paid unevenly by two or more family
members — for example, a $100 dinner where $80 was yours and $20 was
someone else's. This is different from a Trip's even split: shared-expense
amounts can be anything, not just an equal share, and it works for any
transaction, not only trip expenses.

**From the manual capture form:**
1. Select a person and enter the total amount as usual.
2. Tap **"Gasto compartido"** below the form.
3. Check off who else the expense was split with.
4. FlowFin proposes an even split by default — edit any person's amount and
   the rest adjust automatically until the shares add up to the total
   (tap **"Dividir parejo"** to reset to an even split at any time).
5. Save — this creates one transaction per person for their own share, all
   linked together so reports show "your part: $80 of $100."

**From Finia (chat):** describe it in one message, e.g. *"pagué 100 en la
cena, 80 fueron míos y 20 de Silvia"*. Finia proposes the same kind of
draft; confirming it saves the same way as the manual form. If you don't
give per-person amounts and instead say "dividido entre 3" or "a la
mitad," Finia splits it evenly among the people you mention.

Each person's share is validated against your family's actual catalog of
people and categories before saving — you cannot end up with a transaction
assigned to someone who isn't actually in your family, and the shares must
always add up to the stated total.

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

## Latest Updates (v2.22.0 Release Notes)

### New in v2.22.0 (August 10, 2026)

#### 🤝 Shared / split expenses ("Gasto compartido")

You can now split a single purchase unevenly between two or more family
members directly from the manual capture form, not only by asking Finia in
chat. See **Transaction Management → Shared / Split Expenses** above for
how to use it. Each person's share is checked against your family's own
catalog of people and categories on save, so a split can never be assigned
to someone outside your family.

#### 🔒 Permission model — no change this release

The admin/member permission model and defaults (see **Roles & Permissions**
above) are unchanged in this release. The new shared-expense feature uses
the same "create a transaction" access every family member already has by
default — an admin does not need to grant anything new for members to use
it, and it is subject to the same family-only data boundary as every other
transaction.

#### Since v2.20.0 — a quick recap

Several releases landed between v2.20.0 and v2.22.0 without their own
"Latest Updates" entry here; the highlights that affect what you see day to
day:

- **Finia can now read a photographed or uploaded receipt** and turn it
  into a transaction draft, and can propose recurring-charge (scheduled
  payment) drafts.
- **Attaching a photo to Finia got a lot more reliable**: in-page camera
  capture, a clipboard-paste option, and fixes for several ways a picked
  image could silently vanish on mobile.
- **Programados (Scheduled Payments)** was reorganized into three
  lifecycle tabs plus a **Pausados** tab, and pause/resume now actually
  persists.
- **Security**: a critical issue that let the analytics endpoints be
  queried across families without a verified session was closed (v2.20.3);
  several dependency-only security patches shipped with no visible
  behavior change.

#### What's Next
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations

---

## Latest Updates (v2.20.0 Release Notes)

### New in v2.20.0 (July 6, 2026)

#### 🔒 Permissions fix — Viajes and Metas now respect admin settings

**What changed:** The **Viajes** (Trips) and **Metas** (Goals) modules now correctly respect the permissions configured by the family admin in the **Permisos** panel.

Previously, the sidebar navigation always showed these modules to every family member, regardless of what the admin had set. This meant an admin who removed access to Viajes or Metas would see the setting saved in Permisos, but the nav item would still appear for members.

**What this means for you:**
- If the admin has enabled Viajes or Metas for your role, they appear as before — nothing changes.
- If the admin has revoked access to one of these modules, the nav item is now correctly hidden for members without access.
- Default member access is unchanged: members can view both Viajes and Metas by default, and the admin must explicitly revoke access to restrict them.

#### 📡 Active Session Tracking and Force Logout

**What changed:** FlowFin now tracks each browser login as a session. A background heartbeat updates the session's last-active timestamp every minute.

**What this means for you:**
- The ACACIA support team can see which sessions are active for your family and can remotely log out a session if needed (for example, if a device is lost or compromised).
- If your session is revoked remotely, you will be logged out automatically the next time the heartbeat runs (within 60 seconds).
- Each browser tab has its own session record; logging out clears it.

This feature is operated by ACACIA and requires no action from family members or admins.

#### 🔒 Security: RLS hardening for Trips and Support Ticket Messages

The database-level access rules for **Trip** and **SupportTicketMessage** records now scope reads strictly to the owning family. This was already enforced at the application layer; this update adds an additional guard at the database layer to prevent cross-family data access even in edge cases.

#### What's Next
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations

> The previous **v2.19.0** release (Support Tickets, cross-tab session, "Continue as" login) remains in effect — see Previous Releases below.

---

## Latest Updates (v2.19.0 Release Notes)

### New in v2.19.0 (June 29, 2026)

#### 🎫 Support Tickets — contact support directly from the app

A new **Soporte** module is now available from the sidebar.

**What this means for you:**
- Open a support ticket, describe your issue, choose a category (Technical, Billing, Account, Feature Request, or Other), and set a priority.
- Track all your tickets and read replies from the ACACIA support team in one place — no email thread juggling.
- Reply to an open or in-progress ticket directly from the ticket thread view.
- Tickets are private to your family — members of other families cannot see yours.

**Who can access:** All family roles (admin and member) can view, create, and reply to support tickets by default. The family admin can restrict this via the **Permisos** panel if needed (permission keys: `support.ticket.create`, `support.ticket.reply`).

#### 🔒 Session shared across browser tabs

Your FlowFin session now **persists across browser tabs**. Opening a new tab will reuse your existing session instead of sending you back to the login screen. This matches the behaviour of the other ACACIA apps.

**What this means for you:**
- Open FlowFin in multiple tabs without re-authenticating.
- If you log out in one tab, all tabs are effectively logged out (the shared token is cleared).

#### 👤 "Continue as" login card

If you've logged in before, the login screen shows a one-tap card with your name and profile photo. Tap it to resume with your email pre-filled. You can always tap **"Usar otra cuenta"** to log in as someone else. The remembered identity is cleared on explicit logout.

#### 🔒 Permission fix — Support Tickets module

The Support Tickets module now has a full permission manifest (`support.view`, `support.ticket.create`, `support.ticket.reply`) and is gated in the sidebar and in-page by the `module.SupportTickets` permission key. Prior to this release, the route was accessible to all authenticated users without a permission check (access was still scoped to the current family's data via RLS).

#### What's Next
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations

> The previous **v2.18.0** release (Command Palette, unified versioning) and **v0.7.0** (dependency security sweep, `npm audit` = 0 vulnerabilities) remain in effect — see Previous Releases below.

---

## Latest Updates (v2.18.0 Release Notes)

### New in v2.18.0 (June 22, 2026)

#### ⌨️ Command Palette (⌘K) — keyboard-first navigation

A global launcher is now available from anywhere in the app.

**What this means for you:**
- Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) — or tap the **"Buscar…"** button in the sidebar / the 🔍 icon in the mobile top bar — to open it.
- Search and jump instantly to any section you have permission to see, and run quick actions (registrar movimiento, preguntar a Finia, crear meta, planear viaje, cambiar tema) without leaving the current screen.
- Search understands Spanish and English. Press **N** (when not typing) to open transaction capture instantly.

See the new **"Paleta de Comandos (⌘K)"** section in the in-app manual for full details.

#### 🔖 Unified versioning

FlowFin previously carried two version numbers (an engineering line in `package.json` and a product line shown in-app). They are now **unified onto the 2.x product line**, so the number you see in *Acerca de*, the changelog, and the update banner all match. This release moves `package.json` from `0.7.0` to `2.18.0`.

> The previous `v0.7.0` security-sweep release (full dependency remediation, `npm audit` = 0 vulnerabilities) remains in effect — see Previous Releases below.

### Earlier in this cycle — v0.7.0 (June 22, 2026)

#### 🔒 Security — Dependency Sweep (All Tenants)

This release fully resolves all open dependency vulnerabilities. `npm audit` now returns **0 vulnerabilities** across all severity levels.

**What this means for you:**
- The analytics library (`posthog-js`) and its underlying telemetry dependencies have been updated, closing moderate-severity memory and XSS advisories.
- The PDF export library (`jspdf`) dependency chain has been updated, patching a DOMPurify XSS variant.
- The real-time SDK used by Base44 (`socket.io-client`) has been updated, closing a memory-exhaustion denial-of-service advisory in its WebSocket layer.
- A previously accepted build-tool advisory (esbuild) has been fully cleared with no action required.

**No behavior changes** — all features work identically to v0.6.0. This is a security maintenance release.

#### ⚠️ Known Open Issues in v0.7.0
- **INFO**: WaitlistAdmin platform tool — only visible to platform admins; no action required for family admins or members.
- **LOW**: AI response validation hardening (Capture page) — deferred to a future sprint; no known user-facing impact.

#### What's Next
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations

---

## Previous Releases

### v0.6.0 (June 15, 2026)

### New in v0.6.0 (June 15, 2026)

#### 🔒 Security Fix

- **HIGH → RESOLVED**: The `xlsx` (SheetJS) library has been replaced with `write-excel-file`. SheetJS had prototype pollution / ReDoS vulnerabilities with no upstream fix. The Transactions Excel export works exactly as before — same columns, same filename format (`FlowFin_YYYY-MM-DD.xlsx`), same sheet name (`Movimientos`). No action required.

#### 🖱️ UX Improvement — Date Pickers

Date fields across the app now open the calendar when you tap anywhere on the field, not only when tapping the small calendar icon. This affects:

- Reports filters (date range and month selector)
- Investments (start date)
- Investment payment (payment date)
- Scheduled payments (mark paid date)
- Rental payments (payment date and period)
- Goals (target date)
- Trips (start and end dates)
- License Admin (date fields)
- MSI (dates)

#### ⚠️ Known Open Issues in v0.6.0
- **HIGH (accepted, build tool only)**: An esbuild vulnerability (GHSA-gv7w-rqvm-qjhr, CVSS 8.1) is flagged for build tooling. This is a Deno-specific path not used in this project's Node.js build and is not deployed to production. No user-facing risk. A dedicated Vite upgrade will address it.
- **INFO**: WaitlistAdmin platform tool — only visible to platform admins; no action required for family admins or members.

#### What's Next
- Vite 8.x upgrade to clear the esbuild build-tool advisory
- Expand test coverage toward 80%+ target
- Advanced reporting analytics and mobile optimizations

---

### v0.5.0 (June 8, 2026)

#### 🔒 Security Fixes

**Permission Enforcement**
- **MEDIUM → FIXED**: The Savings Dashboard page was accessible to any authenticated family member regardless of their `savings.view` permission. Members now receive a redirect to the Dashboard if they do not have view access (the default for new members).
- **MEDIUM → FIXED**: The permissions system now uses a deny-by-default approach when a partial permission record exists in the database. Previously, null fields in a `RolePermission` record would default to `true`. All fields now default to `false` when not explicitly set.

**RLS Hardening**
- Platform admin accounts can now access and manage all family data for support purposes. Family admins and members are unaffected.
- Conversation sessions are now strictly per-user. AI conversation history is only visible to the user who created it.

**Dependency Update**
- **MODERATE → FIXED**: `react-router` updated to resolve a same-origin open-redirect vulnerability.

---

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
| 2.22.0 | 2026-08-10 | Added v2.22.0 release notes (shared/split expenses); added a "Shared / Split Expenses" how-to under Transaction Management; recapped user-facing changes since v2.20.0. Note: this table's 0.8.0–2.21.0 rows were never backfilled at release time — out of scope for this cycle, see [CHANGELOG.md](./CHANGELOG.md) for the complete history in the meantime. |
| 0.7.0 | 2026-06-22 | Added v0.7.0 release notes: full dependency security sweep, 0 vulnerabilities; moved v0.6.0 to Previous Releases |
| 0.6.0 | 2026-06-15 | Added v0.6.0 release notes: xlsx replaced, date picker UX improvement, esbuild advisory accepted; moved v0.5.0 to Previous Releases |
| 0.5.0 | 2026-06-08 | Added v0.5.0 release notes: SavingsDashboard gate, deny-by-default permissions, RLS hardening |
| 0.2.0 | 2026-06-01 | Added Goals, Messages, Savings Dashboard, Trips, Waitlist Admin; updated permissions table; added v0.2.0 release notes |
| 0.1.0 | 2026-06-01 | Initial user manual with security audit findings |

---

**Last Updated**: August 10, 2026
**Next Update**: alongside the next release that changes user-facing behavior, permissions, or licensing

For the latest updates, visit [CHANGELOG.md](./CHANGELOG.md)
