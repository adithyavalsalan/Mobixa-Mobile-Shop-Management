# MOBIXA — Mobile Shop Management System

**MOBIXA** is a full-featured, database-backed web application developed to simplify, automate, and centralize the operational workflow of a mobile phone and accessories retail enterprise. It eliminates manual paper logs, eliminates overselling, records serialized device IMEIs, tracks staff attendance, streamlines point-of-sale invoicing, and delivers real-time business intelligence and financial reporting.

---

## 👥 Project Team & Abstract

> **Team Members:**
> - Adithya M K (64)
> - Aswathi N V (65)
> - Gayathri R (66)
> - Deeksha M P (21)

### Abstract
The Mobile Shop Management System is a software application developed to simplify and automate the day-to-day operations of a mobile retail shop. The system provides an efficient way to manage mobile phone inventory, customer information, supplier details, billing, sales, purchases, and stock records in a centralized database. It reduces the need for manual record keeping, minimizes human errors, and improves the overall efficiency of store management.

The application enables users to add, update, delete, and search mobile product details with ease. It also supports fast billing and invoice generation, helping shop owners serve customers quickly and accurately. The inventory management feature keeps track of available stock and alerts users when stock levels need to be updated. In addition, the system generates reports on sales, purchases, and inventory, making it easier for management to analyze business performance and make informed decisions.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3 (Modern Dark Theme, Glassmorphism & Responsive Flex/Grid), Vanilla JavaScript (ES6+ async/await, Fetch API)
- **Backend:** Node.js, Express.js (RESTful API Architecture)
- **Database:** MongoDB, Mongoose ODM
- **Authentication & Security:** JWT (JSON Web Tokens), Secure HTTP-Only Cookies, bcryptjs password hashing, Helmet HTTP headers, express-rate-limit brute force prevention, NoSQL query sanitation
- **Testing:** Node.js Built-in Test Runner (`node:test`, `node:assert`), Supertest, MongoDB In-Memory Server (`mongodb-memory-server`)

---

## 📂 System Architecture & Directory Structure

```
Mobixa/
├── backend/
│   ├── config/
│   │   └── db.js                 # Safe MongoDB connection & connection status tracker
│   ├── controllers/
│   │   ├── attendanceController.js
│   │   ├── authController.js
│   │   ├── customerController.js
│   │   ├── dashboardController.js
│   │   ├── employeeController.js
│   │   ├── inventoryController.js
│   │   ├── productController.js
│   │   ├── reportController.js
│   │   ├── saleController.js
│   │   └── settingsController.js
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & role authorization (admin/employee)
│   │   └── errorHandler.js       # Centralized error handler & API 404 handler
│   ├── models/
│   │   ├── Attendance.js         # Daily check-in/out timestamps and employee link
│   │   ├── Customer.js           # Customer profiles, unique phone index, lifetime totals
│   │   ├── InventoryMovement.js  # Audit log for every stock in/out/sale/return transition
│   │   ├── Product.js            # Products, prices, costs, SKU, serialized IMEIs
│   │   ├── Sale.js               # Invoices, items, taxes, discounts, payment methods
│   │   ├── Settings.js           # Shop name, address, tax rate, receipt footer
│   │   └── User.js               # Accounts, bcrypt hashed passwords, roles
│   ├── routes/
│   │   ├── attendanceRoutes.js
│   │   ├── authRoutes.js
│   │   ├── customerRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── inventoryRoutes.js
│   │   ├── productRoutes.js
│   │   ├── reportRoutes.js
│   │   ├── saleRoutes.js
│   │   └── settingsRoutes.js
│   ├── scripts/
│   │   └── seed.js               # Database bootstrap script (admin, staff, initial catalog)
│   └── server.js                 # Central Express application entrypoint
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js                # Shared client API caller, auth guard, logout, toasts
│   │   ├── attendance.js
│   │   ├── customer.js
│   │   ├── dashboard.js
│   │   ├── employee-dashboard.js
│   │   ├── employees.js
│   │   ├── inventory.js
│   │   ├── login.js
│   │   ├── products.js
│   │   ├── reports.js
│   │   ├── sales.js
│   │   └── settings.js
│   ├── attendance.html           # Staff check-in & clock-in tracking
│   ├── customer.html             # Customer management & purchase histories
│   ├── dashboard.html            # Administrator executive dashboard
│   ├── employee-dashboard.html   # Staff personal sales & attendance portal
│   ├── employees.html            # User account management & credentials
│   ├── inventory.html            # Stock levels, stock-in, audit adjustments
│   ├── login.html                # Unified admin & employee login
│   ├── products.html             # Product catalog, IMEIs, pricing
│   ├── reports.html              # Sales, profit, inventory valuation & CSV export
│   └── settings.html             # System configuration, tax rates & profile
├── tests/
│   ├── auth.test.js              # Authentication and role permission tests
│   ├── customers_attendance_reports.test.js
│   ├── inventory_and_sales.test.js
│   ├── products.test.js
│   └── setup.js                  # In-memory database fixture setup
├── .env.example
├── .gitignore
├── render.yaml
├── package.json
└── README.md
```

---

## ☁️ Deploy to Render

MOBIXA is a single Node.js web service: Render runs the Express API and serves the frontend from the same origin. MongoDB data must live in MongoDB Atlas; Render's local filesystem is not a database and may be ephemeral.

### 1. Prepare MongoDB Atlas

1. Create an Atlas database user and use a strong password.
2. In Atlas **Network Access**, allow the outbound IP addresses shown for your Render service. Do not rely on your development computer's IP allowlist. Avoid `0.0.0.0/0` for a production database.
3. Use an Atlas connection string whose default database is `mobixa`, and percent-encode reserved characters in the database password.

### 2. Create the Render service

1. Push this repository to GitHub and select **New → Blueprint** in Render. Connect the repository and deploy its `render.yaml`.
2. When prompted, set `MONGO_URI` to the Atlas connection string, plus unique `ADMIN_PASSWORD` and `EMPLOYEE_PASSWORD` values of at least 12 characters. Render generates `JWT_SECRET`; keep it private.
3. The Blueprint sets `NODE_ENV=production`, runs `npm ci` and `npm start`, and checks `/api/health`. Keep the health check green before initializing the database.

### 3. Initialize the production database once

The seed script creates initial settings, the admin and employee accounts, and demo catalog/customer records. Run `npm run seed` once against the new Atlas database using the Render Shell if it is available for your plan. Otherwise, run it from a trusted computer with the same production `MONGO_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, and `EMPLOYEE_PASSWORD` environment values. Do not run it against a database containing records you need to preserve.

After seeding succeeds, remove `ADMIN_PASSWORD` and `EMPLOYEE_PASSWORD` from the Render service environment and save the real account credentials in a password manager. Do not put credentials in GitHub, source files, or deployment logs.

### Deployment notes

- The service binds to Render's `PORT`; do not set a fixed port in Render.
- `/api/health` returns HTTP 503 when MongoDB is disconnected, so Render can detect an unhealthy database connection.
- Free web services can spin down while idle. Use an appropriate paid plan for a shop that needs continuous availability.
- Deployments are triggered by pushes to the connected branch. Review Render's build and runtime logs if a deploy fails.

---

## 📋 Features by Module

### 1. Authentication & Role-Based Access Control (RBAC)
- **Roles:** `admin` (Owner/Manager) and `employee` (Sales Staff).
- Secure password hashing with salt rounds via `bcryptjs`.
- HTTP-Only cookie and Bearer token support.
- Role authorization middleware preventing employees from accessing administrator functionality.
- Automatic session check and redirect based on role upon opening pages.

### 2. Admin Executive Dashboard (`dashboard.html`)
- Live summary cards: Total Revenue, Total Sales Count, Total Active Products, Total Customers, Low Stock Alerts.
- Real-time recent transaction table.
- Low stock warning list.
- Best-selling models breakdown.

### 3. Employee Console (`employee-dashboard.html`)
- Personalized greeting and designation.
- Daily attendance status widget with one-click **Check In** and **Check Out**.
- Real-time personal sales count and personal billed revenue for today.
- Personal lifetime sales volume.
- Recent sales closed by the logged-in employee.

### 4. Products Management (`products.html`)
- Complete CRUD operations on products.
- Fields: Name, SKU (unique uppercase code), Brand, Model, Category, Cost Price, Selling Price, Stock, Min Alert Level, Storage, Color, Serialized IMEIs.
- Dynamic search across name, brand, SKU, and model.
- Filter by Category and Stock Level (In Stock, Low Stock, Out of Stock).
- Soft archiving when a product has historical sales to protect past tax records.

### 5. Inventory & Stock Control (`inventory.html`)
- Current real-time unit counts.
- **Stock-In Replenishment:** Add incoming consignments with supplier invoice numbers and append serialized phone IMEIs.
- **Stock Adjustment:** Audit tool for physical count adjustments with compulsory audit reason logging.
- **Movement History Audit Log:** Tracks every unit change with date, type (`IN`, `OUT`, `SALE`, `ADJUSTMENT`, `RETURN`), delta quantity, previous stock, new stock, and responsible user.

### 6. Sales & Billing POS (`sales.html`)
- Fast Point-of-Sale checkout interface.
- Real-time device selection with live stock and selling prices from MongoDB.
- Specific IMEI unit selection for serialized smartphones.
- Server-authoritative price and total calculation (cannot be tampered with in browser).
- Automatic stock deduction upon sale completion.
- Automated creation or updating of customer lifetime spending profile.
- Printable computer-generated tax invoice receipt (print stylesheet included).
- Authorized return/reversal workflow that automatically restores returned inventory stock.

### 7. Customer Relationship Management (`customer.html`)
- Profiles with unique phone numbers, email, addresses, and notes.
- Detailed purchase history modal showing all previous invoices and items bought.
- Lifetime spending and order metrics.

### 8. Employee & Staff Management (`employees.html`)
- Admin capability to onboard staff accounts with designation, salary, and role.
- Performance inspector showing total bills closed and lifetime revenue generated.
- Safety protections: Prevents deactivating or deleting the last active system administrator.

### 9. Attendance & Time Tracking (`attendance.html`)
- Daily check-in and check-out with server-validated timestamps.
- Prevents duplicate active check-ins on the same calendar day.
- Admin overview table displaying attendance records across all staff members.

### 10. Reports & Financial Intelligence (`reports.html`)
- **Sales & Gross Profit:** Gross revenue, discounts given, tax collected, Cost of Goods Sold (COGS), and calculated gross profit.
- **Inventory Valuation:** Total stocked units, cost valuation, retail valuation, and potential margin.
- **Customer Spending Analysis:** Top clients and order totals.
- **Employee Performance:** Comparative sales closed and revenue generated.
- **One-Click Export:** Download CSV reports directly or print formatted reports.

### 11. Settings & Shop Configuration (`settings.html`)
- Profile preferences: Update user name and contact info.
- Password change with old password verification.
- Admin shop configuration: Store name, helpline, address, currency symbol (`₹`), GST tax rate (`18%`), invoice prefix (`MOB`), receipt footer note.

---

## 🚀 Quick Setup & Launch Guide (Windows)

### Option A: 1-Click Double-Click Launch (Recommended for Windows)

1. **First-time setup:** Double-click **`setup.bat`**
   *(Checks Node.js, installs npm packages, and creates `.env` if needed. Configure the required secrets in `.env` before seeding.)*
2. **Start the application:** Double-click **`start.bat`**
   *(Launches the server and automatically opens your web browser to `http://localhost:5000`).*

---

### Option B: Terminal Launch (PowerShell / Command Prompt)

#### Prerequisites:
1. **Node.js** (v18 or higher): Verify via `node -v`
2. **MongoDB**:
   - Use a local MongoDB Community Server at `mongodb://127.0.0.1:27017`, or configure a MongoDB Atlas cluster using the steps below.
   - For local MongoDB only, if the service is unavailable and a MongoDB binary is already cached, the app attempts to start it automatically.
3. **Configure secrets:** Copy `.env.example` to `.env` if needed. Set `JWT_SECRET` to a random value of at least 32 characters, and set unique `ADMIN_PASSWORD` and `EMPLOYEE_PASSWORD` values of at least 12 characters each. Generate a JWT secret with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Never commit or share `.env`.

### Use MongoDB Atlas (Cloud)

The app already supports Atlas through `MONGO_URI`; no code or dependency changes are needed.

1. Create a MongoDB Atlas cluster and a **database user** with a strong password. This database user is separate from your Atlas website login.
2. In Atlas **Network Access**, allow the public IP address of the computer running MOBIXA. Avoid allowing access from all IP addresses (`0.0.0.0/0`) except temporarily for isolated testing.
3. In Atlas, select **Connect → Drivers → Node.js** and copy the connection string. Replace its password placeholder with the database user's password and select the `mobixa` database, for example:
   ```text
   mongodb+srv://<database-user>:<password>@<cluster-host>/mobixa?retryWrites=true&w=majority
   ```
   If the password contains reserved URI characters (such as `@`, `:`, `/`, or `#`), percent-encode them before putting it in the connection string.
4. In the project root, edit the existing `.env` file and set `MONGO_URI` to the Atlas connection string:
   ```env
   MONGO_URI=mongodb+srv://<database-user>:<password>@<cluster-host>/mobixa?retryWrites=true&w=majority
   ```
   Keep the URI on one line and do not commit or share `.env`; it is excluded by `.gitignore`.
5. Run `npm.cmd run seed` to create the initial settings, accounts, catalog, and sample customers in Atlas, then run `npm.cmd start`.
6. Confirm the startup log says MongoDB connected and check `http://localhost:5000/api/health` for `"isConnected": true`.

Changing `MONGO_URI` connects MOBIXA to Atlas but does **not** copy existing local records. The seed command adds the project's initial sample records to the selected Atlas database; it is not a local-to-cloud migration.

#### Terminal Commands:
```powershell
# 1. Open project directory
cd Mobixa

# 2. Install dependencies
npm.cmd install

# 3. Seed initial database records
npm.cmd run seed

# 4. Start the server
npm.cmd start
```

---
```powershell
npm.cmd run seed
```
This automatically sets up:
- Administrator and employee accounts using the email addresses and passwords configured in `.env`
- Default store settings (Tax rate 18%, INR currency, invoice template)
- Initial smartphones (iPhone 15, Galaxy S24, OnePlus 12, Pixel 9, Redmi Note 14, AirPods) with initial stock and IMEIs
- Initial customer profiles

---

### Step 5: Start the Application
```powershell
npm.cmd start
```
The server will start and print:
```
[Database] MongoDB connected: localhost/mobixa
[Mobixa] Server running at http://localhost:5000
[Mobixa] Serving static frontend from: ...\frontend
```

---

### Step 6: Access the Application in Your Browser
Open your browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)** (or [http://localhost:5000/login.html](http://localhost:5000/login.html))

---

## 🔑 Initial Login Accounts

The seed script creates an administrator and employee using `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMPLOYEE_EMAIL`, and `EMPLOYEE_PASSWORD` from `.env`. Choose and retain your own passwords; no default login passwords are provided.

---

## 🧪 Running Tests & Verification

MOBIXA comes with an automated unit test suite and a live end-to-end verification script:

### 1. In-Memory Automated Unit & Integration Suite
```powershell
npm.cmd test
```

### 2. Live Server End-to-End Workflow Verification
Verify live HTTP endpoints, role-based protection, IMEI tracking, and POS calculations:
```powershell
npm.cmd run verify
```

### Test Coverage Highlights
- ✅ **Authentication**: Valid login, bcrypt password verification, role authorization, invalid credentials, token extraction, session logout.
- ✅ **Products**: Creation, duplicate SKU prevention, text search, stock level filters, serialized IMEI array tracking, authorization rules.
- ✅ **Inventory & Sales POS**: Stock-in replenishment, audit adjustments, real-time total calculations, stock deduction, insufficient stock prevention, sale cancellation and stock return.
- ✅ **Customers & Attendance**: Customer creation, unique phone enforcement, attendance check-in lifecycle, duplicate check-in prevention, sales and profit report generation.
- ✅ **Live Server E2E**: 48/48 live assertions covering all 12 modules on `http://localhost:5000`.

---

## 🛡️ Common Troubleshooting

1. **`Cannot GET /login.html`**:
   - **Resolved**: Express static middleware is configured using absolute paths (`path.join(__dirname, '../frontend')`), ensuring frontend assets are served correctly regardless of the command working directory.
2. **`Address already in use :::5000`**:
   - Another process may already be running MOBIXA. Check which process owns the port before deciding whether to stop it; otherwise set `PORT=5001` in `.env`:
     ```powershell
     Get-NetTCPConnection -LocalPort 5000 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
     ```
3. **MongoDB Connection Warning**:
   - For local MongoDB, ensure the service is running. For Atlas, check the `MONGO_URI` in `.env`, the database user's credentials, and that your current public IP is allowed in Atlas **Network Access**.
4. **Execution Policy Error with `npm`**:
   - On Windows PowerShell, type `npm.cmd` instead of `npm`.
