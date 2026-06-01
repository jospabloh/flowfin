# FlowFin User Manual

**Version**: 0.1.0  
**Last Updated**: June 1, 2026  
**Status**: BETA (Development Stage)

---

## ⚠️ Important Notice

FlowFin is currently in **BETA development stage (v0.1.0)**. This version includes critical security updates but is **not yet recommended for production use with real financial data**. 

For the latest security information, see [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md).

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Features](#core-features)
3. [Using the Dashboard](#using-the-dashboard)
4. [Transaction Management](#transaction-management)
5. [AI Assistant (Finia)](#ai-assistant-finia)
6. [Family Features](#family-features)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Latest Updates (v0.1.0)](#latest-updates-v010)

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

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View transactions | ✅ | ✅ | ✅ |
| Add transactions | ✅ | ✅ | ❌ |
| Edit transactions | ✅ | ✅* | ❌ |
| Delete transactions | ✅ | ❌ | ❌ |
| Manage budgets | ✅ | ✅ | ❌ |
| Manage goals | ✅ | ✅ | ❌ |
| Invite members | ✅ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Manage roles | ✅ | ❌ | ❌ |

*Editors can edit only their own transactions

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

## Latest Updates (v0.1.0)

### New in v0.1.0 (June 1, 2026)

#### 🔒 Security Improvements (CRITICAL)
- **Security Audit Completed**: Comprehensive review of all code and dependencies
- **Fixed Critical Vulnerabilities**:
  - Updated jsPDF with HTML injection fix
  - Updated Axios with 16+ security patches
  - Fixed token storage security issues
  - Added input validation for all numeric fields
  - Implemented JSON schema validation

#### 📊 Feature Enhancements
- **Transaction Calculator Widget**: Quick math in transaction entry
- **Scheduled Payment Conversion**: Easy conversion of transactions to recurring
- **Enhanced AI Assistant** (Finia):
  - Improved response accuracy
  - New quick action chips
  - Better receipt parsing
  
#### 📱 UI/UX Improvements
- Refreshed transaction entry modal
- Better mobile responsiveness
- Improved chart visualization
- Enhanced category selection

#### 🐛 Bug Fixes
- Fixed NaN handling in amounts
- Corrected API response validation
- Improved error messages
- Fixed layout issues on small screens

#### 📈 Performance
- Reduced bundle size by 15%
- Faster transaction loading
- Optimized database queries
- Improved image compression

### Known Issues in v0.1.0
- xlsx library pending security fix (upstream issue)
- CSRF protection depends on Base44 SDK implementation
- Test coverage being expanded (currently <30%)
- Some accessibility features in progress

### What's Next (v0.2.0 - Expected July 2026)
- Comprehensive test suite (80%+ coverage)
- Advanced reporting and analytics
- Mobile app (iOS/Android)
- Offline mode improvements
- Additional language support
- Dark mode refinements

### Migration from Previous Versions
If upgrading from v0.0.0:
1. No breaking changes
2. All data is preserved
3. New security features are automatic
4. No action required by users

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
| 0.1.0 | 2026-06-01 | Initial user manual with security updates |

---

**Last Updated**: June 1, 2026  
**Next Update**: June 15, 2026 (after v0.1.1 patch release)

For the latest updates, visit [CHANGELOG.md](./CHANGELOG.md)
