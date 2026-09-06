# 🏙️ CityCare Pro — City Complaint & Service Platform API
> **Apollo Level 2 Web Development — Batch 7 Assignment 6 (B7A6)**  
> **Student ID:** L2B7-0440 (Digit 0: City Complaint & Service Platform)

---

## 📌 Project Overview
CityCare Pro is a scalable, secure, and modern RESTful API platform enabling citizens to report urban issues, city departments to assign and track resolutions, and administrators to oversee municipal operations.

### Key Highlights
- **3 Distinct Roles**: `CITIZEN`, `STAFF`, and `ADMIN` with granular JWT Bearer role-based middleware.
- **Firebase Google Authentication (GCP Social Login)** alongside email/password with bcrypt hashing.
- **Universal Table-Level Soft Delete Archiving**: Deleting a record from any active table (`complaints_info`, `users`, `departments`, `payments`) automatically archives a complete snapshot into its paired `*_del` table (`complaints_info_del`, `users_del`, `departments_del`, `payments_del`) inside atomic Prisma `$transaction` blocks.
- **Real Payment Gateway (Stripe)**: Integrated specifically for **Premium / Specialized Municipal Services** (e.g. Hazardous chemical disposal, certified tree removal, commercial inspection permits) with checkout session creation, webhook verification, and payment tracking.
- **26+ RESTful APIs** under versioned `/api/v1/` routes with Zod input validation, rate limiting, and security headers.
- **Audit Logs**: Automatic audit trail recording every state change and critical action.

---

## 🔑 Demo Credentials for Evaluation

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@citycare.com` | `admin123456` |
| **Staff** (Road Dept) | `staff@citycare.com` | `staff123456` |
| **Citizen** | `citizen@citycare.com` | `citizen123456` |

---

## 🛠️ Tech Stack & Architecture

- **Runtime & Language**: Node.js v24+, TypeScript 7+
- **Framework**: Express.js 5
- **Database & ORM**: PostgreSQL with Prisma ORM 7.8 (Multi-file schemas)
- **Validation**: Zod (strict request body and query parameter validation)
- **Authentication**: JWT (Access + Refresh token rotation) + Firebase Admin (GCP Social Login)
- **Payment Processing**: Stripe API (Checkout sessions & Webhooks)
- **Media Upload**: Multer + Cloudinary
- **Security**: Helmet, express-rate-limit, CORS, bcryptjs
- **Architecture**: `Routes` ➔ `Controllers` ➔ `Services` ➔ `Prisma Client` ➔ `PostgreSQL`

---

## 🚀 Getting Started

### 1. Installation
```bash
cd .
npm install
```

### 2. Environment Configuration
Create or inspect `.env` in `backend_server`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:1234@localhost:5432/citycare_db?schema=public"
JWT_ACCESS_SECRET="citycare_super_secure_jwt_access_secret_2026_dev"
JWT_REFRESH_SECRET="citycare_super_secure_jwt_refresh_secret_2026_dev"
SITE_URL="http://localhost:5173"
DEFAULT_PREMIUM_FEE=25.00
STRIPE_SECRET_KEY="sk_test_placeholder"
```

### 3. Generate Prisma Client & Run Migrations
```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Demo Data
```bash
npm run seed
```

### 5. Start the Development Server
```bash
npm run dev
```
API runs at: `http://localhost:3000`

---

## 📋 Comprehensive API Catalog (26+ Endpoints)

### 🔐 1. Authentication (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register new Citizen or Staff user |
| `POST` | `/login` | Public | Email/Password login, returns JWT tokens |
| `POST` | `/firebase-google` | Public | Authenticate via Firebase Google ID token |
| `POST` | `/refresh-token` | Public | Refresh expired access token |
| `POST` | `/logout` | Authenticated | Revoke refresh token and clear cookies |
| `GET` | `/me` | Authenticated | Get current authenticated user profile |

### 👤 2. User Management (`/api/v1/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/me` | Authenticated | View own profile details |
| `PATCH` | `/me` | Authenticated | Update name, phone, or avatar |

### 📋 3. Complaints & Workflows (`/api/v1/complaints`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/` | Citizen/Admin | Submit new complaint with optional photo upload |
| `GET` | `/` | Public/Auth | List complaints with search, category/status filter & pagination |
| `GET` | `/:id` | Public/Auth | Get detailed complaint with timeline & assigned staff |
| `PATCH` | `/:id` | Citizen/Admin | Update complaint details |
| `DELETE` | `/:id` | Citizen/Admin | **Soft Delete: moves record from `complaints_info` to `complaints_info_del`** |
| `POST` | `/:id/restore` | Admin | **Restore complaint from `complaints_info_del` back to `complaints_info`** |
| `GET` | `/archived` | Admin | View archived complaints from `complaints_info_del` |
| `GET` | `/my-complaints` | Citizen | List complaints submitted by logged-in citizen |
| `GET` | `/assigned-to-me` | Staff/Admin | List complaints assigned to logged-in staff |
| `PATCH` | `/:id/assign` | Admin | Assign department and staff to complaint |
| `PATCH` | `/:id/status` | Staff/Admin | Update status (IN_PROGRESS, RESOLVED, REJECTED) & log timeline |
| `POST` | `/:id/feedback` | Citizen | Submit rating (1-5) and review for resolved issue |

### 💳 4. Payment Gateway — Stripe (`/api/v1/payments`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/initiate` | Citizen | Initiate Stripe checkout for Premium / Specialized Services |
| `GET` | `/verify` | Public/Auth | Verify Stripe checkout session status |
| `POST` | `/webhook` | Stripe/Public | Stripe webhook listener for real payment confirmation |
| `GET` | `/my-payments` | Citizen | View citizen payment transaction history |
| `DELETE` | `/:id` | Admin | Soft delete payment record to `payments_del` |

### 📊 5. Administration & Analytics (`/api/v1/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/dashboard-stats` | Admin | Overview statistics (Total, Pending, Resolved, Urgent, SLA) |
| `GET` | `/category-analytics`| Admin | Category breakdown count for charts |
| `GET` | `/audit-logs` | Admin | Paginated system audit trail |
| `GET` | `/deleted-complaints`| Admin | View archived complaints table |
| `GET` | `/users` | Admin | List all users with role filtering |
| `PATCH` | `/users/:id/role` | Admin | Modify user role |
| `DELETE` | `/users/:id` | Admin | Soft delete user to `users_del` |
| `GET` | `/departments` | Authenticated | List all municipal departments |
| `POST` | `/departments` | Admin | Create a new department |
| `DELETE` | `/departments/:id` | Admin | Soft delete department to `departments_del` |

---

## 📦 Postman Documentation
Import the included collection file directly into Postman or Thunder Client:
```text
backend_server/postman_collection.json
```
The collection comes pre-configured with environment variables, sample request bodies, query parameters, and Bearer token headers.
