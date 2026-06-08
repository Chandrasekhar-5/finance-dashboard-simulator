# Day 02 — Backend Foundations Setup

## Work Completed

Today focused on starting the backend application setup and establishing foundational backend architecture.

---

# Backend Initialization

Created backend application directory:

```bash
mkdir banking-backend
cd banking-backend
```

Initialized npm:

```bash
npm init -y
```

---

# Installed Runtime Dependencies

```bash
npm install express cors dotenv zod helmet express-async-errors @prisma/client
```

---

# Installed Development Dependencies

```bash
npm install -D typescript ts-node nodemon prisma @types/node @types/express @types/cors
```

---

# Why These Packages Were Chosen

## express

Used as the primary backend HTTP server framework.

---

## cors

Enables controlled cross-origin requests between frontend and backend.

---

## dotenv

Used for environment variable management.

---

## zod

Used for:
- runtime validation
- schema validation
- type-safe environment parsing

---

## helmet

Adds basic HTTP security headers.

---

## express-async-errors

Simplifies async error handling in Express routes.

---

# Environment Variable Validation

Created:

```txt
src/env.ts
```

Purpose:
- validate all required environment variables during startup
- fail fast if configuration is invalid
- provide type-safe access to validated environment variables

---

# Validation Flow

## Step 1 — Load Environment Variables

```ts
import dotenv from "dotenv";

dotenv.config();
```

---

## Step 2 — Define Validation Schema

```ts
const envSchema = z.object({
  ...
});
```

All required environment variables are defined inside the schema.

---

## Step 3 — Validate Environment Variables

```ts
const parsed = envSchema.safeParse(process.env);
```

`safeParse()` returns:

### Success

```ts
{
  success: true,
  data: ...
}
```

### Failure

```ts
{
  success: false,
  error: ...
}
```

---

# Fail-Fast Startup Strategy

If validation fails:
- errors are logged
- application startup is terminated immediately

This prevents:
- invalid runtime configuration
- silent environment issues
- production misconfiguration bugs

---

# Current Backend Status

Backend currently includes:
- dependency setup
- TypeScript tooling
- Express setup preparation
- environment validation architecture

---

# Learnings

Today reinforced understanding of:
- backend initialization
- runtime configuration validation
- fail-fast architecture
- production-safe environment management
- TypeScript backend tooling

---

# Next Steps

- Setup TypeScript configuration
- Create Express server
- Add middleware configuration
- Setup centralized error handling
- Configure Prisma client
- Setup PostgreSQL connection

---

<br>

# Day 03 — Error Handling & Infrastructure Setup 

# Centralized Environment Validation

Created:

```txt
src/config/env.ts
```

Purpose:

- validate required environment variables
- fail fast on invalid configuration
- expose typed configuration object

---

# Validation Flow

```txt
.env

↓

dotenv.config()

↓

process.env

↓

zod validation

↓

validated configuration
```

Used:

```ts
safeParse()
```

instead of throwing parsers because validation errors can be handled more safely.

---

# Centralized Error Handling

Created:

```txt
src/middleware/errorHandler.ts
```

Purpose:

- eliminate repetitive try/catch blocks
- centralize API error responses
- simplify controller logic

The backend uses:

```ts
express-async-errors
```

which automatically forwards async thrown errors into the centralized handler.

---

# Error Handler Responsibilities

The error handler:

- extracts status codes
- extracts error messages
- logs stack traces
- returns standardized responses

Response shape:

```json
{
   "success": false,
   "message": "Error Message",
   "stack": "development only"
}
```

Stack traces are exposed only during development.

---

# Express Application Setup

Created:

```txt
src/app.ts
```

Configured middleware:

## Helmet

Used for security headers.

## CORS

Used for frontend/backend communication.

## JSON Parser

Used for request body parsing.

---

# Health Check Endpoint

Created:

```txt
GET /check
```

Returns:

- status
- timestamp

Used for:

- deployment verification
- server monitoring
- infrastructure testing

---

# Server Initialization

Created:

```txt
src/server.ts
```

Responsibilities:

- initialize server
- initialize database layer
- handle process lifecycle
- register shutdown handlers

---

# Graceful Shutdown Implementation

Implemented shutdown handlers for:

- SIGINT
- SIGTERM

---

# Shutdown Process

Graceful shutdown performs:

1. Stop accepting new requests

2. Finish active requests

3. Close database safely

4. Exit process cleanly

---

# Why Graceful Shutdown Matters

Without graceful shutdown:

- requests may terminate midway
- database connections may leak
- deployments become unsafe
- inconsistent state becomes possible

---

# Problem 1 — Prisma Client Import Failure

Encountered:

```ts
import { PrismaClient } from '@prisma/client'
```

Error:

```txt
Module '"@prisma/client"' has no exported member 'PrismaClient'
```

---

# Investigation

Attempted:

```bash
rm -rf node_modules

npm install

rm -rf prisma/generated

npx prisma generate
```

Eventually regenerated Prisma artifacts and resolved dependency inconsistency.

---

# Problem 2 — Incorrect Server Execution

Attempted:

```bash
nodemon --exec ts-node src/server.js
```

This crashed.

Reason:

The backend is TypeScript-based and should execute:

```bash
nodemon --exec ts-node src/server.ts
```

Using `.js` created runtime issues.

---

# Problem 3 — PrismaClientInitializationError

Server crashed during startup:

```txt
PrismaClientInitializationError
```

Spent significant time debugging.

Initially assumed:

- invalid database URL
- broken schema
- failed migration
- corrupted client generation

None solved the issue.

---

# Root Cause Discovery

After research and documentation review, discovered the issue was caused by architectural changes introduced in Prisma 7.

---

## Why It Happened

### Strict Constructor Requirements

Prisma 7 no longer allows:

```ts
new PrismaClient()
```

without explicitly defining runtime configuration.

---

### Missing Runtime Context

The project uses:

```txt
postgresql://...
```

direct PostgreSQL connections.

Prisma 7 now requires a driver adapter layer between Prisma Client and PostgreSQL.

Without this adapter:

Prisma cannot initialize.

---

# Required Dependencies

Installed:

```bash
npm install pg @prisma/adapter-pg

npm install -D @types/pg
```

---

# Refactoring Prisma Setup

Updated:

```txt
src/lib/prisma.ts
```

Implemented:

- PostgreSQL connection pool
- PrismaPg adapter
- adapter injection into Prisma Client

---

# Synchronised Prisma Artifacts

Regenerated Prisma artifacts:

```bash
npx prisma generate
```

---

# Result

Backend startup finally succeeded.

---

# Learnings

Today's work reinforced:

- centralized backend architecture
- middleware design
- server lifecycle management
- graceful shutdown patterns
- debugging infrastructure failures
- Prisma runtime architecture
- adapting to breaking library changes

---

# Current Backend Status

Current backend includes:

✓ Environment Validation

✓ Express Setup

✓ Security Middleware

✓ Error Handling

✓ Health Check Route

✓ Graceful Shutdown

✓ Prisma Initialization

✓ Database Connectivity

---

# Next Steps

- Configure TypeScript project properly
- Create module structure
- Setup route architecture
- Create service layer
- Begin authentication module

---

# Day 04 — Authentication System Implementation

## Work Completed

Today's focus was implementing the authentication system architecture and establishing proper separation between validation, business logic, and HTTP handling.

---

# Installed Authentication Dependencies

Installed:

```bash
npm install bcrypt jsonwebtoken cookie-parser
```

Installed types:

```bash
npm install -D \
@types/bcrypt \
@types/jsonwebtoken \
@types/cookie-parser
```

Purpose:

- bcrypt → password hashing
- jsonwebtoken → authentication tokens
- cookie-parser → cookie handling

---

# Custom Error Architecture

Created:

```txt
src/utils/AppError.ts
```

Purpose:

- standardized application errors
- centralized status codes
- consistent error handling

---

# AppError Design

Created a custom class extending:

```ts
Error
```

Included:

- message
- statusCode

Also used:

```ts
Error.captureStackTrace()
```

Purpose:

- cleaner debugging
- preserve stack trace integrity

---

# Request Validation Middleware

Created:

```txt
src/middleware/validate.ts
```

Purpose:

- validate requests before reaching controllers
- reject invalid payloads automatically
- centralize request validation

---

# Validation Flow

Incoming Request

↓

Validation Middleware

↓

Zod Schema Check

↓

Valid Request → Continue

OR

↓

Invalid Request → Return 400

---

# Validation Strategy

The middleware validates:

```ts
req.body

req.query

req.params
```

using:

```ts
schema.parseAsync()
```

---

# Validation Failure Response

Invalid requests return:

```json
{
   "success": false,
   "message": "Validation Error",
   "details": [...]
}
```

Validation details include:

- field path
- failure message

---

# Authentication Module Structure

Created:

```txt
src/modules/auth/
```

Goal:

Separate:

- schemas
- business logic
- HTTP handling

This improves:

- maintainability
- testing
- scalability

---

# Authentication Schemas

Created:

```txt
auth.schema.ts
```

Implemented:

## Register Schema

Fields:

- firstName
- lastName
- email
- password

---

## Login Schema

Fields:

- email
- password

---

# Authentication Service Layer

Created:

```txt
auth.service.ts
```

Purpose:

Contains business logic only.

Controllers should not contain business rules.

---

# Register Flow

Registration performs:

1. Check existing user

2. Throw error if exists

3. Hash password

4. Create user

5. Generate tokens

6. Return tokens

---

# Login Flow

Login performs:

1. Find user

2. Validate existence

3. Compare password

4. Generate tokens

5. Return tokens

---

# Password Security

Used:

```ts
bcrypt.hash()
```

and:

```ts
bcrypt.compare()
```

Passwords are never stored directly.

---

# Token Generation

Authentication generates:

## Access Token

Used for:

- authenticated requests

---

## Refresh Token

Used for:

- session renewal

---

# Authentication Controller Layer

Created:

```txt
auth.controller.ts
```

Responsibilities:

- receive requests
- call services
- return responses

Controllers remain thin.

---

# Cookie Handling

Refresh token is stored inside:

```txt
HTTP Cookies
```

This allows:

- persistent sessions
- refresh token separation

---

# Logout Flow

Logout performs:

1. Clear refresh token cookie

2. Return success response

---

# Authentication Routes

Created routes:

```txt
POST /register

POST /login

POST /logout
```

---

# Route Validation

Routes use:

```ts
validate(schema)
```

before controllers.

This ensures invalid requests never reach business logic.

---

# App Integration

Updated:

```txt
src/app.ts
```

Added:

```ts
cookieParser()
```

Mounted:

```ts
/api/v1/auth
```

---

# Testing

Authentication system was tested using multiple scenarios.

Tested:

- valid requests
- invalid payloads
- duplicate users
- login failures
- logout behavior

---

# Architecture Achieved

Current auth architecture:

```txt
Request

↓

Routes

↓

Validation Middleware

↓

Controller

↓

Service Layer

↓

Database
```

---

# Learnings

Today's work reinforced:

- layered backend architecture

- request validation patterns

- authentication design

- service layer separation

- token-based authentication

- centralized error management

---

# Current Authentication Status

✓ Register

✓ Login

✓ Logout

✓ Validation Middleware

✓ Password Hashing

✓ JWT Generation

✓ Cookie Handling

✓ Service Layer Separation

---

# Next Steps

- Refresh token flow

- Authentication middleware

- Protected routes

- Role handling

- Session security improvements

---

# API Documentation Setup

Implemented Swagger documentation support.

Installed:

```bash
npm install swagger-ui-express

npm install swagger-jsdoc
```

Installed development types:

```bash
npm install -D @types/swagger-ui-express

npm install -D @types/swagger-jsdoc
```

---

# Purpose of Swagger Integration

Swagger was added to provide:

- API documentation
- endpoint discoverability
- easier frontend/backend collaboration
- simplified testing
- interactive API exploration

---

# Swagger Configuration

Created:

```txt
src/swagger.ts
```

Configured:

## OpenAPI Version

```txt
openapi
```

Defines API specification version.

---

## Information Block

Configured:

- title
- version
- description

Purpose:

Provide metadata about the backend API.

---

## Servers Configuration

Defined:

- URL
- Description

Purpose:

Allows API consumers to understand available environments.

---

## API Scanning

Configured:

```txt
apis
```

Used for automatic route documentation discovery.

---

# Generated Swagger Specification

Created:

```ts
swaggerSpec
```

which exports generated OpenAPI specifications.

---

# App Integration

Updated:

```txt
src/app.ts
```

Added:

```ts
app.use(
   "/api-docs",
   swaggerUi.serve,
   swaggerUi.setup(swaggerSpec)
)
```

---

# Documentation Endpoint

Swagger UI is now available at:

```txt
/api-docs
```

Purpose:

- inspect APIs visually
- test endpoints directly
- verify request/response formats

---

# Current Backend Capabilities

Current backend now includes:

✓ Authentication

✓ Validation Middleware

✓ JWT Handling

✓ Error Handling

✓ Swagger Documentation

✓ Interactive API Testing

✓ Health Check Route

---

# Learnings

Today's Swagger integration reinforced:

- API-first development

- OpenAPI specifications

- backend documentation workflows

- frontend/backend collaboration practices

---

# Why Documentation Early Matters

Adding documentation early prevents:

- undocumented endpoints

- frontend confusion

- inconsistent request structures

- API maintenance problems

Swagger becomes more valuable as modules increase.

---


---


# Swagger Documentation Architecture Improvements

Created:

```txt
src/docs/components/
```

Purpose:

Create reusable documentation components rather than repeating schemas and responses across routes.

---

# Reusable Responses

Created:

```txt
src/docs/components/responses.ts
```

Contains reusable response definitions.

Examples:

- InternalServerError (500)
- Unauthorized (401)
- Forbidden (403)
- BadRequest (400)
- NotFound (404)
- Conflict (409)

Purpose:

- reduce duplication
- standardize API documentation
- simplify maintenance

---

# Reusable Schemas

Created:

```txt
src/docs/components/schemas.ts
```

Contains reusable response schemas.

Examples:

- AuthResponse
- UserResponse
- TransactionResponse
- AccountResponse

Purpose:

- centralize schema definitions
- reuse response structures
- maintain consistency

---

# Swagger Refactoring

Updated:

```txt
src/swagger.ts
```

Added:

```txt
components
```

which now includes:

- reusable schemas
- reusable responses

This improves long-term maintainability as modules increase.

---

# Authentication Documentation Improvements

Added API documentation to:

## Register

Added:

- 201 responses
- error responses

---

## Login

Added:

- 200 responses
- error responses

---

## Logout

Added:

- reusable error responses

---

# Extending Express Request Type

Problem:

Express Request does not know custom properties.

Needed:

```ts
req.user
```

Created:

```txt
src/types/express.d.ts
```

Extended:

```ts
Express.Request
```

Added:

```ts
user
```

property.

---

# TypeScript Configuration Update

Updated:

```txt
tsconfig.json
```

Added:

```txt
typeRoots
```

Purpose:

Allow TypeScript to discover custom declaration files.

---

# Authentication Middleware

Created:

```txt
src/middleware/requireAuth.ts
```

Purpose:

Protect authenticated routes.

---

# Authentication Flow

Request

↓

Authorization Header

↓

Extract Bearer Token

↓

Verify JWT

↓

Attach User Context

↓

Continue Request

---

# Token Validation Logic

Checks:

## Missing Authorization Header

Returns:

```txt
401 Unauthorized
```

---

## Invalid Token Format

Returns:

```txt
401 Unauthorized
```

---

## Expired Token

Returns:

```txt
401 Unauthorized
```

---

## Invalid Payload

Returns:

```txt
401 Unauthorized
```

---

# JWT Payload Challenges

Problem:

```ts
jwt.verify()
```

returns:

```ts
string | JwtPayload
```

This means:

TypeScript cannot guarantee:

```ts
decoded.userId
```

exists.

---

# Solution

Created:

```ts
interface CustomJwtPayload
```

Extended:

```ts
JwtPayload
```

Added:

```ts
userId
```

Performed runtime validation before usage.

---

# Important Learning

The problem was not direct casting itself.

The larger issue was:

```ts
token
```

and:

```ts
decoded.userId
```

both require runtime guarantees.

Type safety alone cannot solve runtime uncertainty.

---

# Refresh Token Flow

Implemented:

```txt
AuthService.refreshToken()
```

---

# Refresh Process

1. Verify refresh token

2. Extract user ID

3. Find user

4. Generate new tokens

5. Return tokens

---

# Refresh Controller

Created:

```txt
POST /refresh
```

Flow:

- read refresh cookie
- validate token
- generate new tokens
- update refresh cookie
- return new access token

---

# Protected User Profile Endpoint

Implemented:

```txt
GET /me
```

Purpose:

Return authenticated user information.

---

# Request User Context

Because:

```ts
requireAuth
```

runs first,

usage becomes:

```ts
req.user!.id
```

The non-null assertion is safe here.

---

# /me Response

Returns:

- id
- email
- firstName
- lastName

---

# Protected Routes Added

Added:

```txt
POST /refresh

GET /me
```

---

# Authentication System Status

Current auth system supports:

✓ Register

✓ Login

✓ Logout

✓ Refresh Tokens

✓ Protected Routes

✓ User Context Injection

✓ Profile Retrieval

✓ Request Validation

✓ Swagger Documentation

✓ Typed Request Extensions

---

# Testing

Tested:

- refresh flow

- protected routes

- expired tokens

- invalid tokens

- missing tokens

- authenticated user retrieval

---

# Architecture Achieved

Current flow:

```txt
Request

↓

Validation Middleware

↓

Authentication Middleware

↓

Controller

↓

Service Layer

↓

Database

↓

Response
```

---

# Learnings

Today's work reinforced:

- JWT authentication patterns

- refresh token architecture

- TypeScript runtime safety

- middleware chaining

- request augmentation

- reusable API documentation

- protected route design

---

# Current Project Status

Phase 1 — Domain Modeling ✓

Phase 2 — Backend Foundations ✓

Phase 3 — Authentication System ✓

Authentication module is now largely complete.

---

# Next Steps

- Authorization layer

- Accounts module

- Beneficiary module

- Transaction engine

- Banking workflows


---

# Refresh Token Persistence

Authentication originally supported refresh tokens but did not persist them.

To improve session security and allow proper token revocation, refresh token persistence was implemented.

---

# Database Changes

Added:

```txt
RefreshToken Model
```

to:

```txt
schema.prisma
```

Purpose:

- persist refresh tokens
- enable logout
- enable logout everywhere
- support session management
- allow token revocation

---

# Token Storage Layer

Created:

```txt
src/utils/tokenStorage.ts
```

Purpose:

Centralize refresh token storage logic.

This prevents authentication services from directly manipulating token tables.

---

# Token Storage Responsibilities

Implemented:

## hashToken()

Purpose:

Hash refresh tokens before storage.

Used:

```ts
crypto
```

Reason:

Refresh tokens should never be stored directly.

---

## storeRefreshToken()

Purpose:

Persist refresh tokens.

Responsibilities:

- calculate expiry
- remove previous token for same device
- store hashed token
- associate device metadata

---

## validateRefreshToken()

Purpose:

Verify whether a refresh token still exists.

Process:

```txt
Token

↓

Hash

↓

Database Lookup

↓

Valid / Invalid
```

---

## deleteRefreshToken()

Purpose:

Used during:

- logout

Deletes:

single refresh token session.

---

## deleteAllUserRefreshTokens()

Purpose:

Used during:

- logout everywhere
- password changes
- session invalidation

Deletes:

all user sessions.

---

## getUserSessions()

Purpose:

Retrieve active sessions.

Supports future:

- device management
- account security views

---

## revokeSession()

Purpose:

Remove a specific session.

Supports future:

- session management UI

---

# Device Information Support

Created:

```ts
DeviceInfo
```

interface.

Purpose:

Allow session identification.

Examples:

- browser
- device
- operating system

---

# Login Flow Changes

Login now:

1. Authenticate user

2. Generate tokens

3. Persist refresh token

4. Store device information

5. Return session

---

# Refresh Flow Changes

Refresh token flow now performs:

1. Validate refresh token exists

2. Decode token

3. Remove old token

4. Generate new tokens

5. Persist new refresh token

6. Return updated session

---

# Token Rotation

Refresh flow now rotates refresh tokens.

Old refresh token:

```txt
INVALIDATED
```

New refresh token:

```txt
GENERATED
```

Benefits:

- replay protection
- reduced token theft impact
- improved security

---

# Cookie Improvements

Updated:

```txt
setRefreshCookie()
```

Added:

```txt
/api/v1/auth
```

path restriction.

Purpose:

Reduce unnecessary cookie exposure.

---

# Device Information Extraction

Created:

```txt
getDeviceInfo()
```

Purpose:

Capture session metadata.

Used during:

- login
- session creation

---

# Logout Bug Investigation

Problem:

Logout cleared cookies.

But:

Refresh tokens remained inside database.

---

# Root Cause

Problem was:

```txt
userId
```

was undefined.

The flow depended on:

```txt
Controller

↓

Service

↓

Token Deletion
```

without guaranteed user information.

---

# Considered Solution 1

Protect:

```txt
/logout
```

using:

```txt
requireAuth
```

Problem:

If access token expired:

```txt
User clicks logout

↓

401 Unauthorized

↓

Cannot logout
```

Creates poor user experience.

---

# Final Solution

Removed:

```txt
userId dependency
```

Instead:

- decode refresh token
- extract user ID internally
- perform deletion directly

Result:

Logout now correctly removes database session.

---

# Logout-All Investigation

Problem:

Refresh tokens removed from database.

But:

Cookies remained on devices.

---

# Understanding

The server:

```txt
Cannot access cookies
stored on other devices
```

This is expected behavior.

Removing database sessions is sufficient.

---

# Improvement Implemented

Current device cookie is now cleared.

Result:

- current device logs out immediately
- other devices lose session during refresh

---

# Authentication System Status

Authentication now supports:

✓ Register

✓ Login

✓ Logout

✓ Logout Everywhere

✓ Refresh Tokens

✓ Refresh Token Rotation

✓ Hashed Refresh Storage

✓ Session Revocation

✓ Device Sessions

✓ Protected Routes

✓ User Profile Retrieval

---

# Security Improvements Achieved

Added:

- hashed refresh tokens

- token rotation

- session invalidation

- database-backed sessions

- reduced cookie scope

---

# Learnings

Today's work reinforced:

- session architecture

- refresh token security

- token rotation

- device session management

- authentication UX tradeoffs

- stateful session design

---

# Current Authentication Phase

Authentication module is approaching production readiness.

Remaining improvements are primarily:

- email verification

- password reset flows

- OAuth

- rate limiting

- session dashboards


---

# Rate Limiting Implementation

Authentication functionality was expanded with request throttling and abuse protection.

Installed:

```bash
npm install express-rate-limit

npm install -D @types/express-rate-limit
```

---

# Purpose of Rate Limiting

Rate limiting restricts:

- request frequency
- brute force attempts
- automated abuse
- credential stuffing attacks

Requests are limited based on:

- IP address
- email + IP
- authenticated users

depending on route requirements.

---

# Rate Limiting Strategy

Different endpoints require different protection levels.

Reason:

Authentication endpoints have different attack surfaces.

---

# Shared Key Generator

Created:

```txt
getKey()
```

Logic:

## Login Requests

Use:

```txt
email + IP
```

Purpose:

Prevent attackers from:

- brute forcing accounts
- rotating IP addresses

---

## Other Requests

Use:

```txt
IP Address
```

Purpose:

Protect infrastructure.

---

# Register Limiter

Configuration:

```txt
Window:

1 hour

Limit:

10 requests
```

Applies:

```txt
Per IP
```

Purpose:

Reduce account creation abuse.

---

# Login Limiter

Configuration:

```txt
Window:

15 minutes

Limit:

5 attempts
```

Applies:

```txt
Email + IP
```

Additional Behavior:

```txt
Successful logins
do not count
```

Purpose:

Reduce brute force attacks.

---

# Refresh Limiter

Configuration:

```txt
Window:

15 minutes

Limit:

30 refresh attempts
```

Purpose:

Prevent refresh endpoint abuse.

---

# Forgot Password Limiter

Configuration:

```txt
Window:

1 hour

Limit:

3 requests
```

Purpose:

Reduce reset abuse.

---

# Change Password Limiter

Configuration:

```txt
Window:

1 hour

Limit:

5 attempts
```

Purpose:

Prevent repeated password attacks.

---

# Global API Limiter

Configuration:

```txt
Window:

1 minute

Limit:

100 requests
```

Applied globally.

Purpose:

Protect backend resources.

---

# Route Integration

Applied rate limiting to:

```txt
/register

/login

/refresh
```

Added:

```txt
Global API Limiter
```

inside:

```txt
app.ts
```

---

# Security Improvements Achieved

Added:

- brute force protection

- credential stuffing mitigation

- request throttling

- infrastructure protection

- endpoint-specific policies

---

# Password Reset Infrastructure

Authentication system now includes password reset architecture.

Purpose:

Allow users to recover accounts securely.

---

# Database Changes

Added:

```txt
PasswordReset Model
```

inside:

```txt
schema.prisma
```

---

# Password Reset Model Purpose

Stores:

- token hashes

- expiration timestamps

- usage status

- ownership

Supports:

- secure recovery flows

- token invalidation

- replay prevention

---

# Password Reset Model Design

Includes:

```txt
id

userId

tokenHash

expiresAt

createdAt

usedAt
```

Added indexes for:

```txt
userId

expiresAt
```

Mapped table:

```txt
password_resets
```

---

# Migration

Database migrated to synchronize new model.

---

# Password Reset Service

Created:

```txt
src/utils/passwordReset.ts
```

Purpose:

Centralize reset token management.

---

# Reset Token Generation

Implemented:

```txt
generateResetToken()
```

Responsibilities:

1. Generate random token

2. Hash token

3. Remove existing unused tokens

4. Create reset record

5. Return plain token

---

# Why Return Plain Token

Stored:

```txt
HASHED TOKEN
```

Returned:

```txt
PLAIN TOKEN
```

Reason:

The token must be:

- emailed to users

while:

- database remains protected

---

# Reset Token Expiration

Tokens expire after:

```txt
1 Hour
```

Purpose:

Reduce stolen token risk.

---

# Token Verification

Implemented:

```txt
verifyResetToken()
```

Responsibilities:

1. Hash provided token

2. Find matching record

3. Verify:

- not expired

- not used

4. Return associated user

---

# Invalid Token Handling

If:

- expired

- missing

- already used

returns:

```txt
Invalid Reset Token
```

---

# Consuming Reset Tokens

Implemented:

```txt
markTokenUsed()
```

Purpose:

Prevent token reuse.

Behavior:

```txt
usedAt = current time
```

This makes reset tokens:

```txt
Single Use
```

---

# Security Improvements Achieved

Added:

- hashed reset tokens

- token expiration

- single-use reset links

- replay prevention

- reset invalidation

---

# Authentication Status

Authentication currently supports:

✓ Register

✓ Login

✓ Logout

✓ Logout Everywhere

✓ Refresh Rotation

✓ Session Storage

✓ Protected Routes

✓ Rate Limiting

✓ Password Reset Infrastructure

✓ Device Sessions

---

# Learnings

Today's work reinforced:

- abuse prevention strategies

- endpoint-specific rate limiting

- recovery architecture

- token lifecycle management

- secure credential recovery

- replay attack prevention

---

# Current Authentication Phase

Authentication module is now transitioning from:

```txt
Feature Complete
```

towards:

```txt
Security Hardened
```

---

# Remaining Major Auth Features

- Email delivery

- Password change flows

- Email verification

- OAuth

- Account lockout strategy

- Audit logging
